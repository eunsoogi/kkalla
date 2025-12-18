import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { Balances } from 'ccxt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import { ErrorService } from '@/modules/error/error.service';
import { CompactFeargreed } from '@/modules/feargreed/feargreed.interface';
import { FeargreedService } from '@/modules/feargreed/feargreed.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { HistoryService } from '@/modules/history/history.service';
import { NewsTypes } from '@/modules/news/news.enum';
import { CompactNews } from '@/modules/news/news.interface';
import { NewsService } from '@/modules/news/news.service';
import { OpenaiService } from '@/modules/openai/openai.service';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { User } from '@/modules/user/entities/user.entity';
import { formatNumber } from '@/utils/number';

import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { BalanceRecommendation } from '../rebalance/entities/balance-recommendation.entity';
import { RecommendationItem } from '../rebalance/rebalance.interface';
import { BalanceRecommendationData } from '../rebalance/rebalance.interface';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeData, TradeRequest } from '../trade/trade.interface';
import { SymbolVolatility } from './market-volatility.interface';
import {
  UPBIT_BALANCE_RECOMMENDATION_CONFIG,
  UPBIT_BALANCE_RECOMMENDATION_PROMPT,
  UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA,
} from './prompts/balance-recommendation.prompt';

/**
 * 마켓 변동성 감시 모듈의 핵심 서비스.
 *
 * - `HistoryService` 에 저장된 종목 목록을 기준으로, 각 종목의 1분봉 캔들을 주기적으로 조회한다.
 * - 최근 11개의 1분봉을 사용해 10분 윈도우 2개(이전 10분, 현재 10분)의 변동폭을 계산한다.
 * - 변동폭을 5%p(기본 0.05) 단위 버킷으로 나눈 뒤, 이전 버킷보다 큰 버킷으로 진입한 경우에만
 *   변동성이 증가했다고 판단하고 잔고 추천 추론 및 Slack 알림을 트리거한다.
 * - 동시 실행 방지를 위해 Redlock 기반 분산 락을 사용한다.
 */
@Injectable()
export class MarketVolatilityService implements OnModuleInit {
  private readonly logger = new Logger(MarketVolatilityService.name);
  /**
   * 개별 종목 변동 구간(step) 비율 (기본 5% → 0.05).
   *
   * - 변동폭 비율(0~1)을 이 값으로 나눠 버킷 인덱스를 계산한다.
   * - 예: 0~5% → 0, 5~10% → 1, 10~15% → 2 ...
   */
  private readonly VOLATILITY_BUCKET_STEP = 0.05;
  /**
   * BTC/KRW 전역 변동 구간(step) 비율 (기본 1% → 0.01).
   *
   * - BTC/KRW는 더 민감하게(1% 단위) 변동성을 감지해 포트폴리오 전체 재추론 트리거에 사용한다.
   */
  private readonly BTC_VOLATILITY_BUCKET_STEP = 0.01;
  private readonly BTC_SYMBOL = 'BTC/KRW';
  private readonly MINIMUM_TRADE_RATE = 0;
  private readonly COIN_MAJOR_ITEM_COUNT = 2;
  private readonly COIN_MINOR_ITEM_COUNT = 5;
  private readonly NASDAQ_ITEM_COUNT = 0;

  // Amazon SQS
  private readonly sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  private readonly queueUrl = process.env.AWS_SQS_QUEUE_URL_VOLATILITY;

  /**
   * @param historyService   잔고 추천 대상 종목 목록(히스토리)을 제공
   * @param upbitService     Upbit 1분봉 캔들 조회
   * @param inferenceService 변동성 증가 종목에 대한 잔고 추천 추론 실행
   * @param slackService     변동성 트리거 발생 시 서버 Slack 채널로 알림 전송
   * @param scheduleService  스케줄 활성화된 사용자 목록 조회
   * @param categoryService  카테고리 권한 확인
   * @param notifyService    사용자 알림 전송
   * @param profitService    수익금 조회
   * @param i18n             i18n 기반 로그/알림 메시지 포맷팅
   */
  constructor(
    private readonly historyService: HistoryService,
    private readonly upbitService: UpbitService,
    private readonly slackService: SlackService,
    private readonly scheduleService: ScheduleService,
    private readonly categoryService: CategoryService,
    private readonly notifyService: NotifyService,
    private readonly profitService: ProfitService,
    private readonly i18n: I18nService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
    private readonly openaiService: OpenaiService,
    private readonly featureService: FeatureService,
    private readonly errorService: ErrorService,
  ) {
    if (!this.queueUrl) {
      throw new Error('AWS_SQS_QUEUE_URL_VOLATILITY environment variable is required');
    }
  }

  /**
   * 모듈 초기화 시 SQS Consumer 시작
   */
  async onModuleInit() {
    this.startConsumer();
  }

  /**
   * SQS Consumer 시작
   *
   * - 변동성 전용 SQS 큐에서 메시지를 소비하기 시작합니다.
   * - 오류 발생 시 5초 후 자동으로 재시작합니다.
   */
  private async startConsumer(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    try {
      // 메시지 소비 루프 시작
      await this.consumeMessage();
    } catch (error) {
      // 오류 발생 시 로그 기록
      this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      this.logger.log(this.i18n.t('logging.sqs.consumer.restart'));

      // 5초 후 자동 재시작 (무한 루프 방지를 위한 지연)
      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  /**
   * SQS 메시지 소비 루프
   *
   * - 변동성 전용 큐에서 메시지를 지속적으로 폴링합니다.
   * - 최대 10개의 메시지를 한 번에 받아 병렬로 처리합니다.
   * - 메시지가 없으면 20초 대기 후 다시 폴링합니다.
   */
  private async consumeMessage(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    // 무한 루프로 지속적으로 메시지 폴링
    while (true) {
      try {
        // SQS에서 최대 10개의 메시지를 한 번에 받아옴 (20초 대기)
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
        );

        // 메시지가 없으면 다음 루프로 진행
        if (!result.Messages?.length) continue;

        this.logger.log(
          this.i18n.t('logging.sqs.consumer.processing', {
            args: { count: result.Messages.length },
          }),
        );

        // 받아온 모든 메시지를 병렬로 처리
        await Promise.all(result.Messages.map((message) => this.handleMessage(message)));
      } catch (error) {
        // 오류 발생 시 로그만 기록하고 루프 계속 진행 (안정성)
        this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      }
    }
  }

  /**
   * 개별 SQS 메시지 처리
   *
   * - 변동성 전용 큐의 메시지를 처리합니다.
   * - 사용자별 변동성 거래를 실행하고 수익금 알림을 전송합니다.
   * - 처리 완료 후 메시지를 큐에서 삭제합니다.
   *
   * @param message SQS 메시지
   */
  private async handleMessage(message: Message): Promise<void> {
    const messageId = message.MessageId;
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));

    try {
      // 메시지 본문 파싱: 사용자 정보, 추론 결과, 매수 가능 여부 추출
      const messageBody = JSON.parse(message.Body);
      const { user, inferences, buyAvailable } = messageBody;

      // Volatility 전용 큐이므로 모든 메시지를 처리
      // 사용자별 변동성 거래 실행
      const trades = await this.executeVolatilityTradesForUser(user, inferences, buyAvailable ?? true);

      this.logger.debug(trades);

      // 수익금 조회 및 사용자에게 알림 전송
      const profitData = await this.profitService.getProfit(user);

      await this.notifyService.notify(
        user,
        this.i18n.t('notify.profit.result', {
          args: {
            profit: formatNumber(profitData.profit),
          },
        }),
      );

      this.logger.log(this.i18n.t('logging.sqs.message.complete', { args: { id: messageId } }));

      // 처리 완료된 메시지를 큐에서 삭제 (중복 처리 방지)
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );

      this.logger.log(this.i18n.t('logging.sqs.message.delete', { args: { id: messageId } }));
    } catch (error) {
      // 오류 발생 시 로그 기록 후 예외 재발생 (메시지가 다시 큐로 돌아가도록)
      this.logger.error(
        this.i18n.t('logging.sqs.message.error', {
          args: { id: messageId, error },
        }),
      );
      throw error;
    }
  }

  /**
   * 매 분 실행되는 마켓 변동성 체크 스케줄
   *
   * - 매 분마다 실행되어 시장 변동성을 감시합니다.
   * - Redlock을 사용하여 동일 리소스에 대한 중복 실행을 방지합니다.
   * - 실제 변동성 체크 로직은 `checkMarketVolatility`로 위임합니다.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  @WithRedlock({ duration: 30_000 })
  public async handleTick(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    // 시장 변동성 체크 실행
    await this.checkMarketVolatility();
  }

  /**
   * 시장 변동성 체크 메인 함수
   *
   * - 히스토리 종목 목록을 가져와 각 종목별 변동성을 계산합니다.
   * - BTC/KRW 변동성을 먼저 확인하여 전체 재추론 여부를 판단합니다.
   * - BTC 변동성이 없으면 개별 종목 변동성을 확인합니다.
   * - 버킷이 증가한(새로운 변동 구간에 진입한) 종목만 수집하여 처리합니다.
   */
  private async checkMarketVolatility(): Promise<void> {
    // 잔고 추천 대상(히스토리) 종목 목록을 조회
    const historyItems = await this.historyService.fetchHistory();

    if (!historyItems.length) {
      // 감시할 종목이 없으면 조용히 종료
      this.logger.log(this.i18n.t('logging.market.volatility.no_history'));
      return;
    }

    // 1. BTC/KRW 변동성(1% 단위)을 먼저 확인해, 글로벌 재추론 트리거 여부를 판단
    const isBtcTriggered = await this.triggerBtcVolatility(historyItems);

    // BTC 변동성이 감지됐다면: 전체 재추론만 수행하고, 개별 종목 변동성 검사는 생략
    if (isBtcTriggered) {
      return;
    }

    // 2. BTC 변동성이 감지되지 않았다면, 개별 종목 변동성을 기준으로 트리거를 검사
    await this.triggerPerSymbolVolatility(historyItems);
  }

  /**
   * BTC/KRW 변동성 감지 시 전체 재추론 트리거
   *
   * - BTC/KRW는 1% 단위로 변동성을 감지하여 더 민감하게 반응합니다.
   * - 1%p 단위 버킷 증가를 감지하면 history 전체에 대해 잔고 추천을 수행합니다.
   * - 추론 결과를 바탕으로 스케줄 활성화된 사용자들에 대해 실제 거래를 실행합니다.
   * - 기존 보유 종목은 매도하지 않고, 추론된 종목만 거래합니다.
   * - BTC 변동성이 감지되면 개별 종목 변동성 체크는 생략합니다.
   *
   * @param historyItems 히스토리 종목 목록
   * @returns 변동성이 감지되어 트리거가 발생했는지 여부
   */
  private async triggerBtcVolatility(historyItems: RecommendationItem[]): Promise<boolean> {
    let btcVolatility: SymbolVolatility | null;

    try {
      // BTC/KRW 변동성 계산 (1% 단위로 더 민감하게 감지)
      btcVolatility = await this.calculateSymbolVolatility(this.BTC_SYMBOL, this.BTC_VOLATILITY_BUCKET_STEP);
    } catch (error) {
      // BTC 변동성 계산 오류는 전체 흐름을 깨지 않고 로그만 남김
      // 개별 심볼 체크가 계속 진행될 수 있도록 false 반환
      this.logger.error(
        this.i18n.t('logging.market.volatility.check_failed', { args: { symbol: this.BTC_SYMBOL } }),
        error,
      );
      return false;
    }

    // 변동성이 감지되지 않았으면 false 반환
    if (!btcVolatility?.triggered) {
      return false;
    }

    // 변동성 정보를 퍼센트 문자열로 변환 (로그용)
    const prevPercentText = ((btcVolatility.prevPercent ?? 0) * 100).toFixed(2);
    const currPercentText = ((btcVolatility.currPercent ?? 0) * 100).toFixed(2);
    const prevBucketPercentText = ((btcVolatility.prevBucket ?? 0) * 100).toFixed(0);
    const currBucketPercentText = ((btcVolatility.currBucket ?? 0) * 100).toFixed(0);

    this.logger.log(
      this.i18n.t('logging.market.volatility.bucket_increased', {
        args: {
          symbol: this.BTC_SYMBOL,
          prevPercent: prevPercentText,
          currPercent: currPercentText,
          prevBucket: prevBucketPercentText,
          currBucket: currBucketPercentText,
        },
      }),
    );

    // BTC/KRW 변동성 증가 시: history 아이템 전체 재추론
    // BTC는 시장 지표이므로 전체 포트폴리오 재조정
    const inferences: BalanceRecommendationData[] = await this.balanceRecommendation(historyItems);

    // 스케줄 활성화된 사용자 목록 조회
    const users: User[] = await this.scheduleService.getUsers();

    if (users.length === 0) {
      this.logger.log(this.i18n.t('logging.market.volatility.no_users'));
    } else {
      // SQS를 통해 변동성 감지 메시지 전송 (동시 처리 방지)
      await this.publishVolatilityMessage(users, inferences, true);
    }

    // BTC 변동성이 발생했음을 Slack 서버 채널로 알림 전송
    const btcThreshold = (this.BTC_VOLATILITY_BUCKET_STEP * 100).toFixed(0);
    await this.slackService.sendServer({
      message: this.i18n.t('notify.volatility.result', {
        args: {
          symbols: `> ${this.BTC_SYMBOL}`,
          threshold: btcThreshold,
        },
      }),
    });

    return true;
  }

  /**
   * 개별 종목 변동성 기반 트리거
   *
   * - 히스토리 종목 각각에 대해 5%p 단위 변동 버킷 증가 여부를 확인합니다.
   * - 각 종목의 변동성을 병렬로 계산하여 성능을 최적화합니다.
   * - 변동성이 감지된 종목들만 모아 `triggerVolatility`를 호출합니다.
   *
   * @param historyItems 히스토리 종목 목록
   * @returns 하나 이상의 종목에서 변동성이 감지되어 트리거가 발생했는지 여부
   */
  private async triggerPerSymbolVolatility(historyItems: RecommendationItem[]): Promise<boolean> {
    // 심볼 → RecommendationItem 맵 구성 (나중에 변동성 있는 심볼을 RecommendationItem 으로 복원하기 위함)
    const symbolToItem = new Map<string, RecommendationItem>();
    historyItems.forEach((item) => {
      symbolToItem.set(item.symbol, item);
    });

    // 각 종목에 대한 변동성 검사 결과를 모아, 변동성이 감지된 종목만 반환
    // 병렬 처리로 성능 최적화
    const volatileItems = (
      await Promise.all(
        historyItems.map(async (item) => {
          const { symbol } = item;

          try {
            // 개별 종목에 대한 변동성 계산
            const volatility = await this.calculateSymbolVolatility(symbol);
            if (!volatility) {
              return null;
            }

            const { triggered, prevPercent, currPercent, prevBucket, currBucket } = volatility;

            // 버킷이 증가하지 않았다면(새로운 변동 구간에 진입하지 않았다면) 스킵
            if (!triggered) {
              return null;
            }

            // 변동성 정보를 퍼센트 문자열로 변환 (로그용)
            const prevPercentText = (prevPercent * 100).toFixed(2);
            const currPercentText = (currPercent * 100).toFixed(2);
            const prevBucketPercentText = (prevBucket * 100).toFixed(0);
            const currBucketPercentText = (currBucket * 100).toFixed(0);

            // 변동 구간이 상승한 경우, i18n 로그 남기기
            this.logger.log(
              this.i18n.t('logging.market.volatility.bucket_increased', {
                args: {
                  symbol,
                  prevPercent: prevPercentText,
                  currPercent: currPercentText,
                  prevBucket: prevBucketPercentText,
                  currBucket: currBucketPercentText,
                },
              }),
            );

            // RecommendationItem 으로 변환해 반환
            return symbolToItem.get(symbol) ?? null;
          } catch (error) {
            // 개별 심볼 변동성 계산 오류는 전체 흐름을 깨지 않고 로그만 남김
            // 다른 종목들의 변동성 체크는 계속 진행
            this.logger.error(this.i18n.t('logging.market.volatility.check_failed', { args: { symbol } }), error);
            return null;
          }
        }),
      )
    ).filter((item): item is RecommendationItem => !!item);

    // 변동성이 감지된 종목들에 대해 후처리(추론/Slack 알림) 실행
    return this.triggerVolatility(volatileItems);
  }

  /**
   * 종목별 변동성 계산
   *
   * - Upbit에서 최근 1분봉 11개를 조회합니다.
   * - 앞의 10개: "이전 10분" 윈도우, 뒤의 10개: "현재 10분" 윈도우로 사용합니다.
   * - 각 윈도우에 대해 최고 종가 / 최저 종가를 이용해 변동폭 비율을 계산합니다.
   *   - 변동폭 비율 = (maxClose - minClose) / minClose
   * - 변동폭 비율을 stepPercent로 나눠 버킷 인덱스를 구합니다.
   * - 현재 버킷이 이전 버킷보다 클 경우에만 `triggered = true`로 판단합니다.
   * - 캔들이 부족하거나 계산 불가능한 값이 포함되어 있으면 `null`을 반환합니다.
   *
   * @param symbol 종목 심볼
   * @param stepPercent 변동 구간 단위 (기본값: 0.05 = 5%)
   * @returns 변동성 정보 (버킷 증가 여부 + 상세 값) 또는 null
   */
  private async calculateSymbolVolatility(
    symbol: string,
    stepPercent: number = this.VOLATILITY_BUCKET_STEP,
  ): Promise<SymbolVolatility | null> {
    // 최근 11개의 1분봉 캔들을 조회 (이전 10분 + 현재 10분 윈도우 구성용)
    const candles = await this.upbitService.getRecentMinuteCandles(symbol, 11);

    // 캔들이 부족하면 계산 불가
    if (!candles || candles.length < 11) {
      this.logger.log(this.i18n.t('logging.market.volatility.not_enough_candles', { args: { symbol } }));
      return null;
    }

    // 앞의 10개는 "이전 10분", 뒤의 10개는 "현재 10분" 윈도우
    // 슬라이딩 윈도우 방식: 1분씩 이동하여 비교
    const prevWindow = candles.slice(0, 10);
    const nextWindow = candles.slice(1, 11);

    // 각 윈도우의 종가 기준 변동폭 비율 계산
    const prevPercent = this.calculateWindowVolatilityPercent(prevWindow);
    const currPercent = this.calculateWindowVolatilityPercent(nextWindow);

    // 계산 불가능한 값이 포함된 경우 스킵 (-1 반환 시)
    if (prevPercent < 0 || currPercent < 0) {
      return null;
    }

    // prevPercent, currPercent는 0~1 범위의 비율 값이므로, stepPercent로 나눠 버킷 인덱스를 계산
    // 예: 0.05 (5%) / 0.05 = 1 → 버킷 1
    const prevBucketIndex = Math.floor(prevPercent / stepPercent);
    const currBucketIndex = Math.floor(currPercent / stepPercent);

    // 현재 버킷이 이전 버킷보다 크면 변동성 증가로 판단
    const triggered = currBucketIndex > prevBucketIndex;
    // 버킷의 실제 비율 값 계산 (로그용)
    const prevBucket = prevBucketIndex * stepPercent;
    const currBucket = currBucketIndex * stepPercent;

    // 변동성 정보 반환 (버킷 증가 여부 + 상세 값)
    return {
      triggered,
      prevPercent,
      currPercent,
      prevBucket,
      currBucket,
    };
  }

  /**
   * 변동성 감지 시 잔고 추천 및 거래 트리거
   *
   * - 변동성이 감지된 종목이 없으면 로그만 남기고 종료합니다.
   * - 심볼 기준으로 중복을 제거한 뒤, 해당 심볼들에 대해 추론을 수행합니다.
   * - 추론 결과를 바탕으로 스케줄 활성화된 사용자들에 대해 실제 거래를 실행합니다.
   * - 기존 보유 종목은 매도하지 않고, 감지된 종목만 거래합니다.
   * - 서버 Slack 채널로 변동성 감지 알림을 전송합니다.
   *
   * @param volatileItems 변동성이 감지된 종목 목록
   * @returns 변동성이 감지되어 실제로 트리거가 발생했는지 여부
   */
  private async triggerVolatility(volatileItems: RecommendationItem[]): Promise<boolean> {
    // 변동성이 감지된 종목이 없다면 아무 작업도 하지 않음
    if (!volatileItems.length) {
      this.logger.log(this.i18n.t('logging.market.volatility.no_trigger'));
      return false;
    }

    // 중복 종목 제거: 같은 심볼이 여러 번 나타나는 경우 하나만 유지
    const uniqueChangedMap = new Map<string, RecommendationItem>();
    for (const item of volatileItems) {
      uniqueChangedMap.set(item.symbol, item);
    }
    const uniqueChangedItems = Array.from(uniqueChangedMap.values());

    // 변동성이 감지된 종목 개수 로그
    this.logger.log(
      this.i18n.t('logging.market.volatility.trigger_start', {
        args: { count: uniqueChangedItems.length },
      }),
    );

    // 변동성이 감지된 종목들에 대해 잔고 추천 추론 실행
    // 감지된 종목들만 대상으로 추론하여 포트폴리오 조정
    const inferences: BalanceRecommendationData[] = await this.balanceRecommendation(uniqueChangedItems);

    // 스케줄 활성화된 사용자 목록 조회
    const users: User[] = await this.scheduleService.getUsers();

    if (users.length === 0) {
      this.logger.log(this.i18n.t('logging.market.volatility.no_users'));
    } else {
      // SQS를 통해 변동성 감지 메시지 전송 (동시 처리 방지)
      await this.publishVolatilityMessage(users, inferences, true);
    }

    // 변동성이 발생한 심볼 목록을 Slack 서버 채널로 알림 전송
    const symbolsText = uniqueChangedItems.map((item) => `> ${item.symbol}`).join('\n');
    const threshold = (this.VOLATILITY_BUCKET_STEP * 100).toFixed(0);

    await this.slackService.sendServer({
      message: this.i18n.t('notify.volatility.result', {
        args: {
          symbols: symbolsText,
          threshold,
        },
      }),
    });

    return true;
  }

  /**
   * 캔들 배열에서 최저가/최고가를 이용해 변동폭 비율((maxHigh - minLow) / minLow)을 계산.
   * candles: [timestamp, open, high, low, close, volume]
   *
   * - 각 캔들의 high와 low 값을 사용하여 변동폭을 계산한다.
   * - 데이터가 부족하거나 0/NaN 등이 포함된 경우에는 `-1` 을 반환해
   *   상위 로직에서 해당 윈도우를 무시하도록 한다.
   */
  private calculateWindowVolatilityPercent(candles: any[]): number {
    // 캔들이 없으면 계산 불가
    if (!candles || candles.length === 0) {
      return -1;
    }

    // 각 캔들의 최고가(high)와 최저가(low) 추출 (캔들 배열: [timestamp, open, high, low, close, volume])
    const highs = candles.map((candle) => candle[2]);
    const lows = candles.map((candle) => candle[3]);

    // 10분 구간 내 최저 low와 최고 high 계산
    const minLow = Math.min(...lows);
    const maxHigh = Math.max(...highs);

    // 0 또는 NaN 등이 섞여 있으면 계산 불가 처리
    // 유효하지 않은 값이 포함되면 -1 반환하여 상위 로직에서 무시하도록 함
    if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh) || minLow <= 0) {
      return -1;
    }

    // 변동폭 비율 계산: (최고가 - 최저가) / 최저가
    // 예: 최저가 100, 최고가 105 → (105-100)/100 = 0.05 (5%)
    return (maxHigh - minLow) / minLow;
  }

  /**
   * 변동성 감지 SQS 메시지 전송
   *
   * - 변동성 전용 SQS 큐에 사용자별 거래 작업 메시지를 전송합니다.
   * - 각 사용자마다 별도의 메시지를 생성하여 병렬로 전송합니다.
   * - 메시지는 비동기로 처리되어 동시성 문제를 방지합니다.
   *
   * @param users 스케줄 활성화된 사용자 목록
   * @param inferences 변동성 감지된 종목들의 추론 결과
   * @param buyAvailable 매수 가능 여부
   */
  private async publishVolatilityMessage(
    users: User[],
    inferences: BalanceRecommendationData[],
    buyAvailable: boolean = true,
  ): Promise<void> {
    this.logger.log(
      this.i18n.t('logging.sqs.producer.start', {
        args: { count: users.length },
      }),
    );

    try {
      // 각 사용자별로 변동성 거래 메시지 생성
      // 메시지 본문에 사용자 정보, 추론 결과, 매수 가능 여부 포함
      const messages = users.map(
        (user) =>
          new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify({ type: 'volatility', user, inferences, buyAvailable }),
          }),
      );

      // 모든 메시지를 병렬로 전송 (성능 최적화)
      const results = await Promise.all(messages.map((message) => this.sqs.send(message)));
      this.logger.debug(results);
      this.logger.log(this.i18n.t('logging.sqs.producer.complete'));
    } catch (error) {
      // 오류 발생 시 로그 기록 후 예외 재발생
      this.logger.error(this.i18n.t('logging.sqs.producer.error', { args: { error } }));
      throw error;
    }
  }

  /**
   * 사용자별 변동성 거래 실행
   *
   * - SQS consumer에서 호출되는 메인 거래 실행 함수입니다.
   * - 변동성이 감지된 종목들에 대해서만 거래를 수행합니다:
   *   1. 권한이 없는 종목 필터링
   *   2. rate > 0인 종목(매수/비율 조정) 또는 rate <= 0 && hasStock인 종목(전량 매도) 선정
   *   3. 감지된 종목들에 대한 매수/매도 거래 실행
   * - rate <= 0인 경우 전량 매도 신호로 처리됩니다.
   * - 거래 완료 후 사용자에게 알림을 전송합니다.
   *
   * @param user 거래를 실행할 사용자
   * @param inferences 변동성 감지된 종목들의 추론 결과
   * @param buyAvailable 매수 가능 여부 (false인 경우 매도만 수행)
   * @returns 실행된 거래 목록
   */
  public async executeVolatilityTradesForUser(
    user: User,
    inferences: BalanceRecommendationData[],
    buyAvailable: boolean = true,
  ): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링: 사용자가 거래할 수 있는 카테고리만 포함
    const authorizedBalanceRecommendations = await this.filterUserAuthorizedBalanceRecommendations(user, inferences);

    // 권한이 있는 추론이 없으면 거래 불가
    if (authorizedBalanceRecommendations.length === 0) {
      return [];
    }

    // 추론 결과를 사용자에게 알림 전송 (종목별 추천 비율 표시)
    await this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          transactions: authorizedBalanceRecommendations
            .map((recommendation) =>
              this.i18n.t('notify.inference.transaction', {
                args: {
                  symbol: recommendation.symbol,
                  rate: Math.floor(recommendation.rate * 100),
                },
              }),
            )
            .join('\n'),
        },
      }),
    );

    // 유저 계좌 조회: 현재 보유 종목 및 잔고 정보
    const balances = await this.upbitService.getBalances(user);

    // 계좌 정보가 없으면 거래 불가
    if (!balances) return [];

    // 전체 포트폴리오 종목 수 계산 (전체 포트폴리오 비율 유지를 위해 사용)
    const count = await this.getItemCount(user);

    // count가 0이면 거래 불가
    if (count === 0) {
      return [];
    }

    // 편입/편출 결정 분리
    // 1. 편출 대상 종목 매도 요청 (rate <= 0인 종목들만 전량 매도)
    const excludedTradeRequests: TradeRequest[] = this.generateExcludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
    );

    // 2. 편입 대상 종목 매수/매도 요청 (rate > 0인 종목들의 목표 비율 조정)
    let includedTradeRequests: TradeRequest[] = this.generateIncludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
    );

    // 매수 불가능한 경우 매도만 수행 (diff < 0인 것만 필터링)
    if (!buyAvailable) {
      includedTradeRequests = includedTradeRequests.filter((item) => item.diff < 0);
    }

    // 편출 처리: 병렬로 모든 매도 주문 실행
    const excludedTrades: Trade[] = await Promise.all(
      excludedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 편입 처리: 병렬로 모든 매수/매도 주문 실행
    const includedTrades: Trade[] = await Promise.all(
      includedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 실행된 거래 중 null 제거 (주문이 생성되지 않은 경우)
    const allTrades: Trade[] = [...excludedTrades, ...includedTrades].filter((item) => item !== null);

    // 거래가 실행된 경우 사용자에게 알림 전송
    if (allTrades.length > 0) {
      await this.notifyService.notify(
        user,
        this.i18n.t('notify.order.result', {
          args: {
            transactions: allTrades
              .map((trade) =>
                this.i18n.t('notify.order.transaction', {
                  args: {
                    symbol: trade.symbol,
                    type: this.i18n.t(`label.order.type.${trade.type}`),
                    amount: formatNumber(trade.amount),
                    profit: formatNumber(trade.profit),
                  },
                }),
              )
              .join('\n'),
          },
        }),
      );
    }

    // 클라이언트 캐시 초기화 (메모리 누수 방지)
    this.clearClients();

    return allTrades;
  }

  /**
   * 사용자 권한 기반 추론 필터링
   *
   * - 사용자가 거래 권한이 있는 카테고리만 필터링합니다.
   * - 사용자가 활성화한 카테고리만 포함합니다.
   *
   * @param user 사용자
   * @param inferences 추론 결과 목록
   * @returns 권한이 있는 추론 결과만 필터링된 목록
   */
  private async filterUserAuthorizedBalanceRecommendations(
    user: User,
    inferences: BalanceRecommendationData[],
  ): Promise<BalanceRecommendationData[]> {
    // 사용자가 활성화한 카테고리 목록 조회
    const enabledCategories = await this.categoryService.findEnabledByUser(user);

    // 필터링 조건:
    // 1. 사용자가 해당 카테고리에 대한 거래 권한이 있어야 함
    // 2. 사용자가 해당 카테고리를 활성화했어야 함
    return inferences.filter(
      (item) =>
        this.categoryService.checkCategoryPermission(user, item.category) &&
        enabledCategories.some((uc) => uc.category === item.category),
    );
  }

  /**
   * 추론 결과 정렬
   *
   * - 우선순위: 기존 보유 종목 > rate 높은 순
   * - 기존 보유 종목(hasStock=true)을 우선 정렬하고, 그 다음 rate 내림차순으로 정렬합니다.
   *
   * @param inferences 추론 결과 목록
   * @returns 정렬된 추론 결과 목록
   */
  private sortBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    // 정렬 우선순위:
    // 1. 기존 보유 종목(hasStock=true) 우선
    // 2. 둘 다 보유 종목이거나 둘 다 아닌 경우: rate 내림차순
    return inferences.sort((a, b) => {
      // 둘 다 보유 종목이면 순서 유지
      if (a.hasStock && b.hasStock) {
        return 0;
      } else if (a.hasStock) {
        // a만 보유 종목이면 앞으로
        return -1;
      } else if (b.hasStock) {
        // b만 보유 종목이면 앞으로
        return 1;
      }

      // 둘 다 보유 종목이 아니면 rate 비교
      const rateDiff = b.rate - a.rate;

      // 부동소수점 오차 고려: 거의 같으면 0 반환
      if (Math.abs(rateDiff) < Number.EPSILON) {
        return 0;
      }

      // rate 내림차순 정렬
      return rateDiff;
    });
  }

  /**
   * 목표 비율과 현재 비율의 차이 계산
   *
   * - 목표 비율(rate)과 현재 보유 비율의 차이를 계산합니다.
   * - 양수: 매수가 필요, 음수: 매도가 필요
   *
   * @param balances 사용자 계좌 잔고
   * @param symbol 종목 심볼
   * @param rate 목표 비율
   * @param category 카테고리
   * @returns 목표 비율과 현재 비율의 차이 (양수: 매수 필요, 음수: 매도 필요)
   */
  private calculateDiff(balances: Balances, symbol: string, rate: number, category: Category): number {
    switch (category) {
      case Category.COIN_MAJOR:
      case Category.COIN_MINOR:
        return this.upbitService.calculateDiff(balances, symbol, rate);
    }

    return 0;
  }

  /**
   * 사용자별 최대 편입 종목 수 계산
   *
   * - 사용자가 활성화한 카테고리 중 권한이 있는 카테고리만 고려합니다.
   * - 각 카테고리별 최대 종목 수 중 가장 큰 값을 반환합니다.
   * - 전체 포트폴리오 비율을 유지하기 위해 사용됩니다.
   *
   * @param user 사용자
   * @returns 최대 편입 종목 수
   */
  private async getItemCount(user: User): Promise<number> {
    // 사용자가 활성화한 카테고리 목록 조회
    const userCategories = await this.categoryService.findEnabledByUser(user);
    const categories = userCategories.map((uc) => uc.category);

    // 권한이 있는 카테고리만 필터링
    const authorizedCategories = categories.filter((category) =>
      this.categoryService.checkCategoryPermission(user, category),
    );

    // 권한이 있는 카테고리가 없으면 0 반환
    if (authorizedCategories.length < 1) {
      return 0;
    }

    // 각 카테고리별 최대 종목 수 중 가장 큰 값을 반환
    // (여러 카테고리를 활성화한 경우 가장 큰 제한을 적용)
    return Math.max(...authorizedCategories.map((category) => this.getItemCountByCategory(category)));
  }

  /**
   * 카테고리별 최대 종목 수 조회
   *
   * @param category 카테고리
   * @returns 카테고리별 최대 종목 수
   */
  private getItemCountByCategory(category: Category): number {
    switch (category) {
      case Category.COIN_MAJOR:
        return this.COIN_MAJOR_ITEM_COUNT;

      case Category.COIN_MINOR:
        return this.COIN_MINOR_ITEM_COUNT;

      case Category.NASDAQ:
        return this.NASDAQ_ITEM_COUNT;
    }

    return 0;
  }

  /**
   * 편입 대상 추론 필터링
   *
   * - rate > 0인 종목만 필터링합니다 (매수/비율 조정 대상).
   *
   * @param inferences 추론 결과 목록
   * @returns 편입 대상 추론 결과
   */
  private filterIncludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(inferences.filter((item) => item.rate > this.MINIMUM_TRADE_RATE));
  }

  /**
   * 편출 대상 추론 필터링
   *
   * - rate <= 0인 종목만 필터링합니다 (전량 매도 대상).
   *
   * @param inferences 추론 결과 목록
   * @returns 편출 대상 추론 결과
   */
  private filterExcludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(
      inferences.filter((item) => item.rate <= this.MINIMUM_TRADE_RATE && item.hasStock),
    );
  }

  /**
   * 편입 거래 요청 생성
   *
   * - 편입 대상 종목들에 대한 매수/매도 거래 요청을 생성합니다.
   * - diff를 계산하여 목표 비율과 현재 비율의 차이를 구합니다.
   * - diff가 작은 순서대로 정렬하여 우선순위를 결정합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @param count 전체 포트폴리오 종목 수
   * @returns 편입 거래 요청 목록 (diff 오름차순 정렬)
   */
  private generateIncludedTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    count: number,
  ): TradeRequest[] {
    // 편입 대상 종목 선정 (rate > 0인 종목들)
    const filteredBalanceRecommendations = this.filterIncludedBalanceRecommendations(inferences);

    // 편입 거래 요청 생성
    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations
      .map((inference) => ({
        symbol: inference.symbol,
        // diff 계산: 목표 비율(rate/count)과 현재 비율의 차이
        // rate는 단일 코인 기준 집중투자 비율이지만, 전체 포트폴리오 비율을 유지하기 위해 count로 나눔
        // 예: rate=0.5, count=5인 경우 → 목표 비율 0.1 (10%)
        // 양수면 매수 필요, 음수면 매도 필요
        diff: this.calculateDiff(balances, inference.symbol, inference.rate / count, inference.category),
        balances,
        inference,
      }))
      .sort((a, b) => a.diff - b.diff); // 오름차순으로 정렬 (차이가 작은 것부터 처리)

    return tradeRequests;
  }

  /**
   * 편출 거래 요청 생성
   *
   * - 편출 대상 종목들에 대한 매도 거래 요청을 생성합니다.
   * - rate <= 0인 종목들만 전량 매도합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @returns 편출 거래 요청 목록
   */
  private generateExcludedTradeRequests(balances: Balances, inferences: BalanceRecommendationData[]): TradeRequest[] {
    // 편출 대상 종목 선정 (rate <= 0 && hasStock인 종목들)
    const filteredBalanceRecommendations = this.filterExcludedBalanceRecommendations(inferences);

    // 편출 거래 요청 생성: 모두 완전 매도(diff: -1)
    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations.map((inference) => ({
      symbol: inference.symbol,
      diff: -1, // -1은 완전 매도를 의미
      balances,
      inference,
    }));

    return tradeRequests;
  }

  /**
   * 클라이언트 캐시 초기화
   *
   * - Upbit 및 Notify 서비스의 클라이언트 캐시를 초기화합니다.
   * - 거래 완료 후 메모리 누수를 방지하기 위해 호출됩니다.
   */
  private clearClients(): void {
    this.upbitService.clearClients();
    this.notifyService.clearClients();
  }

  /**
   * 개별 거래 실행
   *
   * - 거래 요청을 받아 실제 주문을 생성하고 실행합니다.
   * - 주문 타입(매수/매도), 수량, 수익을 계산하여 Trade 엔티티에 저장합니다.
   *
   * @param user 사용자
   * @param request 거래 요청
   * @returns 생성된 Trade 엔티티 (주문이 없으면 null)
   */
  private async executeTrade(user: User, request: TradeRequest): Promise<Trade> {
    this.logger.log(this.i18n.t('logging.trade.start', { args: { id: user.id, symbol: request.symbol } }));

    // 주문 생성 및 조정: diff 값에 따라 매수/매도 주문 생성
    const order = await this.upbitService.adjustOrder(user, request);

    // 주문이 생성되지 않은 경우 (예: 잔고 부족, 최소 주문 금액 미달 등)
    if (!order) {
      this.logger.log(this.i18n.t('logging.trade.not_exist', { args: { id: user.id, symbol: request.symbol } }));
      return null;
    }

    this.logger.log(this.i18n.t('logging.trade.calculate.start', { args: { id: user.id, symbol: request.symbol } }));

    // 주문 정보 계산: 타입(매수/매도), 수량, 수익
    const type = this.upbitService.getOrderType(order);
    const amount = await this.upbitService.calculateAmount(order);
    const profit = await this.upbitService.calculateProfit(request.balances, order, amount);

    this.logger.log(
      this.i18n.t('logging.trade.calculate.end', {
        args: {
          id: user.id,
          symbol: request.symbol,
          type: this.i18n.t(`label.order.type.${type}`),
          amount,
          profit,
        },
      }),
    );

    this.logger.log(this.i18n.t('logging.trade.save.start', { args: { id: user.id, symbol: request.symbol } }));

    // 거래 정보를 데이터베이스에 저장
    const trade = await this.saveTrade(user, {
      symbol: request.symbol,
      type,
      amount,
      profit,
      inference: request.inference,
    });

    this.logger.log(this.i18n.t('logging.trade.save.end', { args: { id: user.id, symbol: request.symbol } }));

    return trade;
  }

  /**
   * 거래 엔티티 저장
   *
   * - 실행된 거래 정보를 데이터베이스에 저장합니다.
   *
   * @param user 사용자
   * @param data 거래 데이터 (심볼, 타입, 수량, 수익, 추론 정보)
   * @returns 저장된 Trade 엔티티
   */
  private async saveTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.user = user;

    return trade.save();
  }

  /**
   * 선택된 종목들의 매수 비율 추천
   *
   * - AI를 활용하여 각 종목별 매수 비율을 추천합니다.
   * - 실시간 API 호출을 병렬로 처리하여 성능을 최적화합니다.
   * - 추천 결과를 데이터베이스에 저장합니다.
   *
   * @param items 분석할 종목 목록 (hasStock 정보 포함)
   * @returns 저장된 각 종목별 매수 비율 추천 결과
   */
  public async balanceRecommendation(items: RecommendationItem[]): Promise<BalanceRecommendationData[]> {
    this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.start', { args: { count: items.length } }));

    // 각 종목에 대한 실시간 API 호출을 병렬로 처리
    const inferenceResults = await Promise.all(
      items.map((item) => {
        return this.errorService.retryWithFallback(async () => {
          const messages = await this.buildBalanceRecommendationMessages(item.symbol);

          const requestConfig = {
            ...UPBIT_BALANCE_RECOMMENDATION_CONFIG,
            response_format: {
              type: 'json_schema' as const,
              json_schema: {
                name: 'balance_recommendation',
                strict: true,
                schema: UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA,
              },
            },
          };

          // 실시간 API 호출
          const completion = await this.openaiService.createChatCompletion(messages, requestConfig);
          const responseData = JSON.parse(completion.choices[0].message.content);

          // 추론 결과와 아이템 병합
          return {
            ...responseData,
            category: item?.category,
            hasStock: item?.hasStock || false,
          };
        });
      }),
    );

    // 추론 결과가 없으면 빈 배열 반환
    if (inferenceResults.length === 0) {
      this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.complete'));
      return [];
    }

    // 결과 저장
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.presave', { args: { count: inferenceResults.length } }),
    );

    const batchId = randomUUID();
    const recommendationResults = await Promise.all(
      inferenceResults.map((recommendation) => this.saveBalanceRecommendation({ ...recommendation, batchId })),
    );

    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.save', { args: { count: recommendationResults.length } }),
    );

    this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.complete'));

    return recommendationResults.map((saved, index) => ({
      id: saved.id,
      batchId: saved.batchId,
      symbol: saved.symbol,
      category: saved.category,
      rate: saved.rate,
      hasStock: inferenceResults[index].hasStock,
    }));
  }

  /**
   * 포트폴리오 분석 메시지 빌드
   *
   * - 뉴스, 공포탐욕지수, 이전 추론, 개별 종목 특성 데이터를 포함한 프롬프트를 구성합니다.
   *
   * @param symbol 종목 심볼
   * @returns OpenAI API용 메시지 배열
   */
  private async buildBalanceRecommendationMessages(symbol: string): Promise<ChatCompletionMessageParam[]> {
    const messages: ChatCompletionMessageParam[] = [];

    // 시스템 프롬프트 추가
    this.openaiService.addMessage(messages, 'system', UPBIT_BALANCE_RECOMMENDATION_PROMPT);

    // 뉴스 데이터 추가
    const news = await this.fetchNewsData();
    if (news && news.length > 0) {
      this.openaiService.addMessagePair(messages, 'prompt.input.news', news);
    }

    // 공포탐욕지수 추가
    const feargreed = await this.fetchFearGreedData();
    if (feargreed) {
      this.openaiService.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
    }

    // 개별 종목 feature 데이터 추가
    const marketFeatures = await this.featureService.extractMarketFeatures(symbol);

    const marketData = this.featureService.formatMarketData([marketFeatures]);
    this.openaiService.addMessage(messages, 'user', `${this.featureService.MARKET_DATA_LEGEND}\n\n${marketData}`);

    return messages;
  }

  /**
   * 뉴스 데이터 가져오기
   *
   * - 최근 100개의 중요 뉴스를 조회합니다.
   *
   * @returns 뉴스 데이터 배열
   */
  private async fetchNewsData(): Promise<CompactNews[]> {
    const operation = () =>
      this.newsService.getCompactNews({
        type: NewsTypes.COIN,
        limit: 100,
        importanceLower: 1,
        skip: false,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.news.load_failed'), error);
      return [];
    }
  }

  /**
   * 공포탐욕지수 데이터 가져오기
   *
   * - 최신 공포탐욕지수를 조회합니다.
   *
   * @returns 공포탐욕지수 데이터 또는 null
   */
  private async fetchFearGreedData(): Promise<CompactFeargreed | null> {
    const operation = () => this.feargreedService.getCompactFeargreed();

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.feargreed.load_failed'), error);
      return null;
    }
  }

  /**
   * 이전 추론 데이터 가져오기
   *
   * - 최근 7일 이내의 추론 결과를 조회합니다.
   *
   * @param symbol 종목 심볼
   * @returns 이전 추론 결과 배열
   */
  private async fetchRecentRecommendations(symbol: string): Promise<BalanceRecommendation[]> {
    const operation = () =>
      BalanceRecommendation.getRecent({
        symbol,
        createdAt: new Date(Date.now() - UPBIT_BALANCE_RECOMMENDATION_CONFIG.message.recentDateLimit),
        count: UPBIT_BALANCE_RECOMMENDATION_CONFIG.message.recent,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.recent_recommendations_failed'), error);
      return [];
    }
  }

  /**
   * 잔고 추천 결과 저장
   *
   * @param recommendation 잔고 추천 데이터
   * @returns 저장된 잔고 추천 엔티티
   */
  public async saveBalanceRecommendation(recommendation: BalanceRecommendationData): Promise<BalanceRecommendation> {
    const balanceRecommendation = new BalanceRecommendation();
    Object.assign(balanceRecommendation, recommendation);
    return balanceRecommendation.save();
  }
}
