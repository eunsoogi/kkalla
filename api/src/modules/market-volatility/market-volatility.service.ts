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
import type { EasyInputMessage } from 'openai/resources/responses/responses';

import { CacheService } from '@/modules/cache/cache.service';
import { ErrorService } from '@/modules/error/error.service';
import { CompactFeargreed } from '@/modules/feargreed/feargreed.interface';
import { FeargreedService } from '@/modules/feargreed/feargreed.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { HistoryRemoveItem } from '@/modules/history/history.interface';
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
import {
  BalanceRecommendationAction,
  BalanceRecommendationData,
  RecommendationItem,
} from '../rebalance/rebalance.interface';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeData, TradeRequest } from '../trade/trade.interface';
import { UPBIT_MINIMUM_TRADE_PRICE } from '../upbit/upbit.constant';
import { OrderTypes } from '../upbit/upbit.enum';
import { MarketFeatures } from '../upbit/upbit.interface';
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
  private readonly MINIMUM_TRADE_INTENSITY = 0;
  private readonly AI_SIGNAL_WEIGHT = 0.7;
  private readonly FEATURE_SIGNAL_WEIGHT = 0.3;
  private readonly FEATURE_CONFIDENCE_WEIGHT = 0.3;
  private readonly FEATURE_MOMENTUM_WEIGHT = 0.25;
  private readonly FEATURE_LIQUIDITY_WEIGHT = 0.2;
  private readonly FEATURE_VOLATILITY_WEIGHT = 0.15;
  private readonly FEATURE_STABILITY_WEIGHT = 0.1;
  private readonly VOLATILITY_REFERENCE = 0.12;
  private readonly SELL_SCORE_THRESHOLD = 0.6;
  private readonly MIN_REBALANCE_BAND = 0.01;
  private readonly REBALANCE_BAND_RATIO = 0.1;
  private readonly ESTIMATED_FEE_RATE = 0.0005;
  private readonly ESTIMATED_SLIPPAGE_RATE = 0.001;
  private readonly COST_GUARD_MULTIPLIER = 2;
  private readonly VOLATILITY_DIRECTION_THRESHOLD = 0.01;
  private readonly VOLATILITY_SYMBOL_COOLDOWN_SECONDS = 1_800;
  private readonly BTC_VOLATILITY_COOLDOWN_SECONDS = 3_600;
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
   * @param historyService   잔고 추천 대상 종목 목록(포트폴리오)을 제공
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
    private readonly cacheService: CacheService,
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

      // 실행된 거래가 있을 때만 수익금 알림 전송
      if (trades.length > 0) {
        const profitData = await this.profitService.getProfit(user);

        await this.notifyService.notify(
          user,
          this.i18n.t('notify.profit.result', {
            args: {
              profit: formatNumber(profitData.profit),
            },
          }),
        );
      }

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
   * - 포트폴리오 종목 목록을 가져와 각 종목별 변동성을 계산합니다.
   * - BTC/KRW 변동성을 먼저 확인하여 전체 재추론 여부를 판단합니다.
   * - BTC 변동성이 없으면 개별 종목 변동성을 확인합니다.
   * - 버킷이 증가한(새로운 변동 구간에 진입한) 종목만 수집하여 처리합니다.
   */
  private async checkMarketVolatility(): Promise<void> {
    // 잔고 추천 대상(포트폴리오) 종목 목록을 조회
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
   * @param historyItems 포트폴리오 종목 목록
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

    // BTC는 시장 전체 트리거이므로 쿨다운을 길게 적용해 과도한 재추론 방지
    if (await this.isSymbolOnCooldown(this.BTC_SYMBOL)) {
      // 글로벌 BTC 트리거는 건너뛰고, 개별 종목 변동성 체크는 계속 진행한다.
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
      // 포트폴리오 업데이트는 handleMessage에서 거래 완료 후 수행됨
      await this.publishVolatilityMessage(users, inferences, true);
    }

    await this.markSymbolOnCooldown(this.BTC_SYMBOL, this.BTC_VOLATILITY_COOLDOWN_SECONDS);

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
   * - 포트폴리오 종목 각각에 대해 5%p 단위 변동 버킷 증가 여부를 확인합니다.
   * - 각 종목의 변동성을 병렬로 계산하여 성능을 최적화합니다.
   * - 변동성이 감지된 종목들만 모아 `triggerVolatility`를 호출합니다.
   *
   * @param historyItems 포트폴리오 종목 목록
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

            const { triggered, prevPercent, currPercent, prevBucket, currBucket, netDirection } = volatility;

            // 버킷이 증가하지 않았다면(새로운 변동 구간에 진입하지 않았다면) 스킵
            if (!triggered) {
              return null;
            }

            // 버킷 증가만으로는 노이즈가 많아, 순방향 가격 변화가 작은 경우 스킵
            if (Math.abs(netDirection) < this.VOLATILITY_DIRECTION_THRESHOLD) {
              return null;
            }

            // 최근 트리거된 종목은 쿨다운 동안 재진입 방지
            if (await this.isSymbolOnCooldown(symbol)) {
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
    // 슬라이딩 윈도우가 1분씩 겹치므로, 마지막 종가끼리 비교하면 사실상 1분 변화율이 된다.
    // 방향성은 윈도우 전체(첫 종가 -> 마지막 종가) 기준으로 계산해 노이즈 필터 기준과 맞춘다.
    const startClose = Number(prevWindow[0]?.[4] || 0);
    const endClose = Number(nextWindow[nextWindow.length - 1]?.[4] || 0);
    const netDirection = startClose > 0 ? (endClose - startClose) / startClose : 0;

    // 변동성 정보 반환 (버킷 증가 여부 + 상세 값)
    return {
      triggered,
      prevPercent,
      currPercent,
      prevBucket,
      currBucket,
      netDirection,
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
      // 포트폴리오 업데이트는 handleMessage에서 거래 완료 후 수행됨
      await this.publishVolatilityMessage(users, inferences, true);
    }

    // 과매매 방지를 위해 트리거된 심볼에 쿨다운 부여
    await this.markSymbolsOnCooldown(uniqueChangedItems.map((item) => item.symbol));

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
   *   2. intensity > 0인 종목(매수/비율 조정) 또는 intensity <= 0 && hasStock인 종목(전량 매도) 선정
   *   3. 감지된 종목들에 대한 매수/매도 거래 실행
   * - intensity <= 0 또는 편입 상한을 초과한 종목은 전량 매도 대상으로 처리됩니다.
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
                  prevModelTargetWeight: this.toPercent(recommendation.prevModelTargetWeight),
                  modelTargetWeight: this.toPercent(recommendation.modelTargetWeight),
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

    const orderableSymbols = await this.buildOrderableSymbolSet([
      ...authorizedBalanceRecommendations.map((inference) => inference.symbol),
      ...balances.info.map((item) => `${item.currency}/${item.unit_currency}`),
    ]);
    // 거래 가능한 총 평가금액은 사용자당 1회만 계산해 모든 주문에서 재사용
    const marketPrice = await this.upbitService.calculateTradableMarketValue(balances, orderableSymbols);
    // 시장 상황에 따른 전체 익스포저 배율 (risk-on/risk-off)
    const regimeMultiplier = await this.getMarketRegimeMultiplier();
    // 현재가 기준 포트폴리오 비중 맵 (심볼 -> 현재 비중)
    const currentWeights = await this.buildCurrentWeightMap(balances, marketPrice, orderableSymbols);
    const tradableMarketValueMap = await this.buildTradableMarketValueMap(balances, orderableSymbols);

    // 편입/편출 결정 분리
    // 1. 편출 대상 종목 매도 요청 (intensity <= 0인 종목들만 전량 매도)
    const excludedTradeRequests: TradeRequest[] = this.generateExcludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
    );

    // 2. 편입 대상 종목 매수/매도 요청 (intensity > 0인 종목들의 목표 비율 조정)
    let includedTradeRequests: TradeRequest[] = this.generateIncludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
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

    const liquidatedItems = this.collectLiquidatedHistoryItems(
      excludedTradeRequests,
      excludedTrades,
      includedTradeRequests,
      includedTrades,
    );

    if (liquidatedItems.length > 0) {
      await this.historyService.removeHistory(liquidatedItems);
    }

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

  private collectLiquidatedHistoryItems(
    excludedRequests: TradeRequest[],
    excludedTrades: Trade[],
    includedRequests: TradeRequest[],
    includedTrades: Trade[],
  ): HistoryRemoveItem[] {
    const removedMap = new Map<string, HistoryRemoveItem>();

    const collect = (requests: TradeRequest[], trades: Trade[]) => {
      trades.forEach((trade, index) => {
        const request = requests[index];
        if (!trade || !request?.inference || trade.type !== OrderTypes.SELL) {
          return;
        }

        // diff = -1 인 경우를 "전량 매도"로 간주해 포트폴리오 히스토리에서 제거한다.
        if (request.diff > -1 + Number.EPSILON) {
          return;
        }

        const key = `${request.symbol}:${request.inference.category}`;
        removedMap.set(key, {
          symbol: request.symbol,
          category: request.inference.category,
        });
      });
    };

    collect(excludedRequests, excludedTrades);
    collect(includedRequests, includedTrades);

    return Array.from(removedMap.values());
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
   * - 우선순위: 기존 보유 종목 > buyScore 높은 순
   * - 기존 보유 종목(hasStock=true)을 우선 정렬하고, 그 다음 buyScore 내림차순으로 정렬합니다.
   *
   * @param inferences 추론 결과 목록
   * @returns 정렬된 추론 결과 목록
   */
  private sortBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    // 정렬 우선순위:
    // 1. 기존 보유 종목(hasStock=true) 우선
    // 2. 둘 다 보유 종목이거나 둘 다 아닌 경우: buyScore 내림차순
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

      // 둘 다 보유 종목이 아니면 buyScore 비교
      const buyScoreDiff = this.getBuyPriorityScore(b) - this.getBuyPriorityScore(a);

      // buyScore가 유사하면 intensity, 추천 weight/confidence 순으로 정렬
      if (Math.abs(buyScoreDiff) < Number.EPSILON) {
        const intensityDiff = b.intensity - a.intensity;
        if (Math.abs(intensityDiff) >= Number.EPSILON) {
          return intensityDiff;
        }

        const scoreDiff = this.getRecommendationScore(b) - this.getRecommendationScore(a);
        if (Math.abs(scoreDiff) < Number.EPSILON) {
          return 0;
        }
        return scoreDiff;
      }

      // buyScore 내림차순 정렬
      return buyScoreDiff;
    });
  }

  private getRecommendationScore(item: Pick<BalanceRecommendationData, 'weight' | 'confidence'>): number {
    const weight = item.weight ?? 0.1;
    const confidence = item.confidence ?? 0.7;
    return weight * 0.6 + confidence * 0.4;
  }

  private getBuyPriorityScore(item: Pick<BalanceRecommendationData, 'buyScore' | 'intensity'>): number {
    if (item.buyScore != null && Number.isFinite(item.buyScore)) {
      return this.clamp01(item.buyScore);
    }

    return this.clamp01(item.intensity);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return this.clamp(value, 0, 1);
  }

  private isIncludedRecommendation(inference: BalanceRecommendationData): boolean {
    if (inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)) {
      return this.clamp01(inference.modelTargetWeight) > 0;
    }

    return inference.intensity > this.MINIMUM_TRADE_INTENSITY;
  }

  private calculateFeatureScore(marketFeatures: MarketFeatures | null): number {
    // feature 추출이 실패한 경우, 보수적으로 0점 처리하여 매수 편향을 방지합니다.
    if (!marketFeatures) {
      return 0;
    }

    const confidence = this.clamp01((marketFeatures.prediction?.confidence ?? 0) / 100);
    const momentumStrength = this.clamp01((marketFeatures.prediction?.momentumStrength ?? 0) / 100);
    const liquidityScore = this.clamp01((marketFeatures.liquidityScore ?? 0) / 10);
    const volatility = Number.isFinite(marketFeatures.volatility)
      ? (marketFeatures.volatility as number)
      : this.VOLATILITY_REFERENCE;
    const volatilityRatio = this.clamp01(volatility / this.VOLATILITY_REFERENCE);
    const volatilityScore = this.clamp01(1 - volatilityRatio);
    const intensityStability = this.clamp01((marketFeatures.intensityVolatility?.intensityStability ?? 0) / 100);

    return this.clamp01(
      this.FEATURE_CONFIDENCE_WEIGHT * confidence +
        this.FEATURE_MOMENTUM_WEIGHT * momentumStrength +
        this.FEATURE_LIQUIDITY_WEIGHT * liquidityScore +
        this.FEATURE_VOLATILITY_WEIGHT * volatilityScore +
        this.FEATURE_STABILITY_WEIGHT * intensityStability,
    );
  }

  private resolveAction(intensity: number, sellScore: number, modelTargetWeight: number): BalanceRecommendationAction {
    if (modelTargetWeight <= 0) {
      if (intensity <= this.MINIMUM_TRADE_INTENSITY || sellScore >= this.SELL_SCORE_THRESHOLD) {
        return 'sell';
      }
      return 'hold';
    }

    return 'buy';
  }

  private calculateModelSignals(
    intensity: number,
    category: Category,
    marketFeatures: MarketFeatures | null,
    symbol?: string,
  ) {
    const aiBuy = this.clamp01(intensity);
    const aiSell = this.clamp01(-intensity);
    const featureScore = this.calculateFeatureScore(marketFeatures);

    const buyScore = this.clamp01(this.AI_SIGNAL_WEIGHT * aiBuy + this.FEATURE_SIGNAL_WEIGHT * featureScore);
    const sellScore = this.clamp01(this.AI_SIGNAL_WEIGHT * aiSell + this.FEATURE_SIGNAL_WEIGHT * (1 - featureScore));

    let modelTargetWeight = this.clamp01(buyScore);
    if (intensity <= this.MINIMUM_TRADE_INTENSITY || sellScore >= this.SELL_SCORE_THRESHOLD) {
      modelTargetWeight = 0;
    }

    const action = this.resolveAction(intensity, sellScore, modelTargetWeight);
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.model_signal', {
        args: {
          symbol: symbol ?? 'N/A',
          intensity,
          category,
          featureScore,
          buyScore,
          sellScore,
          modelTargetWeight,
          action,
        },
      }),
    );

    return {
      buyScore,
      sellScore,
      modelTargetWeight,
      action,
    };
  }

  private calculateTargetWeight(inference: BalanceRecommendationData, regimeMultiplier: number): number {
    const baseTargetWeight =
      inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)
        ? this.clamp01(inference.modelTargetWeight)
        : this.calculateModelSignals(inference.intensity, inference.category, null, inference.symbol).modelTargetWeight;

    if (baseTargetWeight <= 0) {
      return 0;
    }

    const adjustedTargetWeight = baseTargetWeight * (Number.isFinite(regimeMultiplier) ? regimeMultiplier : 1);
    const modelTargetWeight = this.clamp01(adjustedTargetWeight);
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.target_weight', {
        args: {
          symbol: inference.symbol,
          baseTargetWeight,
          regimeMultiplier,
          modelTargetWeight,
        },
      }),
    );
    return modelTargetWeight;
  }

  private getRebalanceBand(targetWeight: number): number {
    return Math.max(this.MIN_REBALANCE_BAND, targetWeight * this.REBALANCE_BAND_RATIO);
  }

  private shouldRebalance(targetWeight: number, deltaWeight: number): boolean {
    return Math.abs(deltaWeight) >= this.getRebalanceBand(targetWeight);
  }

  private passesCostGate(deltaWeight: number): boolean {
    const minEdge = (this.ESTIMATED_FEE_RATE + this.ESTIMATED_SLIPPAGE_RATE) * this.COST_GUARD_MULTIPLIER;
    return Math.abs(deltaWeight) >= minEdge;
  }

  private calculateRelativeDiff(targetWeight: number, currentWeight: number): number {
    return (targetWeight - currentWeight) / (currentWeight || 1);
  }

  private async getMarketRegimeMultiplier(): Promise<number> {
    try {
      const feargreed = await this.errorService.retryWithFallback(() => this.feargreedService.getCompactFeargreed());
      const value = Number(feargreed?.value);

      if (!Number.isFinite(value)) {
        return 1;
      }

      if (value <= 20) return 0.95;
      if (value <= 35) return 0.97;
      if (value >= 80) return 0.97;
      if (value >= 65) return 0.99;

      return 1;
    } catch {
      return 1;
    }
  }

  private async buildCurrentWeightMap(
    balances: Balances,
    totalMarketValue: number,
    orderableSymbols?: Set<string>,
  ): Promise<Map<string, number>> {
    const weightMap = new Map<string, number>();

    if (!Number.isFinite(totalMarketValue) || totalMarketValue <= 0) {
      return weightMap;
    }

    const weights = await Promise.all(
      balances.info
        .filter((item) => item.currency !== item.unit_currency)
        .map(async (item) => {
          const symbol = `${item.currency}/${item.unit_currency}`;
          const tradableBalance = parseFloat(item.balance || 0);

          if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
            return { symbol, weight: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, weight: 0 };
          }

          try {
            const currPrice = await this.upbitService.getPrice(symbol);
            return { symbol, weight: (tradableBalance * currPrice) / totalMarketValue };
          } catch {
            const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return null;
            }

            return { symbol, weight: (tradableBalance * avgBuyPrice) / totalMarketValue };
          }
        }),
    );

    for (const item of weights) {
      if (!item) {
        continue;
      }

      const { symbol, weight } = item;
      if (weight > 0) {
        weightMap.set(symbol, weight);
      }
    }

    return weightMap;
  }

  private isKrwSymbol(symbol: string): boolean {
    return symbol.endsWith('/KRW');
  }

  private isOrderableSymbol(symbol: string, orderableSymbols?: Set<string>): boolean {
    if (!this.isKrwSymbol(symbol)) {
      return false;
    }

    if (!orderableSymbols) {
      return true;
    }

    return orderableSymbols.has(symbol);
  }

  private isSellAmountSufficient(symbol: string, diff: number, tradableMarketValueMap?: Map<string, number>): boolean {
    if (!tradableMarketValueMap) {
      return true;
    }

    const tradableMarketValue = tradableMarketValueMap.get(symbol);
    if (tradableMarketValue == null) {
      return true;
    }

    if (!Number.isFinite(tradableMarketValue) || tradableMarketValue <= 0) {
      return false;
    }

    return tradableMarketValue * Math.abs(diff) >= UPBIT_MINIMUM_TRADE_PRICE;
  }

  private async buildOrderableSymbolSet(symbols: string[]): Promise<Set<string> | undefined> {
    const targets = Array.from(new Set(symbols.filter((symbol) => this.isKrwSymbol(symbol))));
    if (targets.length < 1) {
      return new Set();
    }

    const checks = await Promise.all(
      targets.map(async (symbol) => {
        try {
          return {
            symbol,
            checked: true,
            exists: await this.upbitService.isSymbolExist(symbol),
          };
        } catch {
          return { symbol, checked: false, exists: false };
        }
      }),
    );

    const checkedCount = checks.filter((check) => check.checked).length;
    if (checkedCount < 1) {
      this.logger.warn('Failed to validate orderable symbols; fallback to KRW-only symbol filtering');
      return undefined;
    }

    if (checkedCount < checks.length) {
      this.logger.warn('Partially failed to validate orderable symbols; include unchecked symbols for safety');
    }

    return new Set(checks.filter((check) => !check.checked || check.exists).map((check) => check.symbol));
  }

  private async buildTradableMarketValueMap(
    balances: Balances,
    orderableSymbols?: Set<string>,
  ): Promise<Map<string, number>> {
    const marketValueMap = new Map<string, number>();

    const values = await Promise.all(
      balances.info
        .filter((item) => item.currency !== item.unit_currency)
        .map(async (item) => {
          const symbol = `${item.currency}/${item.unit_currency}`;
          const tradableBalance = parseFloat(item.balance || 0);
          if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
            return { symbol, marketValue: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, marketValue: 0 };
          }

          try {
            const currPrice = await this.upbitService.getPrice(symbol);
            return { symbol, marketValue: tradableBalance * currPrice };
          } catch {
            const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return { symbol, marketValue: 0 };
            }

            return { symbol, marketValue: tradableBalance * avgBuyPrice };
          }
        }),
    );

    for (const { symbol, marketValue } of values) {
      if (marketValue > 0) {
        marketValueMap.set(symbol, marketValue);
      }
    }

    return marketValueMap;
  }

  private getSymbolCooldownKey(symbol: string): string {
    return `market-volatility:cooldown:${symbol}`;
  }

  private async isSymbolOnCooldown(symbol: string): Promise<boolean> {
    try {
      return Boolean(await this.cacheService.get(this.getSymbolCooldownKey(symbol)));
    } catch (error) {
      this.logger.warn(`Failed to read cooldown cache for ${symbol}; treat as not on cooldown`, error);
      return false;
    }
  }

  private async markSymbolsOnCooldown(symbols: string[]): Promise<void> {
    await Promise.all(
      symbols.map((symbol) => this.markSymbolOnCooldown(symbol, this.VOLATILITY_SYMBOL_COOLDOWN_SECONDS)),
    );
  }

  private async markSymbolOnCooldown(symbol: string, ttlSeconds: number): Promise<void> {
    try {
      await this.cacheService.set(this.getSymbolCooldownKey(symbol), true, ttlSeconds);
    } catch (error) {
      this.logger.warn(`Failed to write cooldown cache for ${symbol}; continue without cooldown`, error);
    }
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
   * - modelTargetWeight > 0인 종목만 필터링합니다 (매수/비율 조정 대상).
   *
   * @param inferences 추론 결과 목록
   * @returns 편입 대상 추론 결과
   */
  private filterIncludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(inferences.filter((item) => this.isIncludedRecommendation(item)));
  }

  /**
   * 편출 대상 추론 필터링
   *
   * - modelTargetWeight = 0 또는 매도 신호인 종목만 필터링합니다 (전량 매도 대상).
   *
   * @param inferences 추론 결과 목록
   * @returns 편출 대상 추론 결과
   */
  private filterExcludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(
      inferences.filter((item) => !this.isIncludedRecommendation(item) && item.hasStock),
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
    regimeMultiplier: number,
    currentWeights: Map<string, number>,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    // 편입 대상 종목 선정 (intensity > 0인 종목들)
    const filteredBalanceRecommendations = this.filterIncludedBalanceRecommendations(inferences);
    const topK = Math.max(1, count);

    // 편입 거래 요청 생성
    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations
      .slice(0, count)
      .map((inference) => {
        if (!this.isOrderableSymbol(inference.symbol, orderableSymbols)) {
          return null;
        }

        const baseTargetWeight = this.calculateTargetWeight(inference, regimeMultiplier);
        const targetWeight = this.clamp01(baseTargetWeight / topK);
        const currentWeight = currentWeights.get(inference.symbol) ?? 0;
        const deltaWeight = targetWeight - currentWeight;

        // 목표와 현재 비중 차이가 작으면 불필요한 재조정을 생략
        if (!this.shouldRebalance(targetWeight, deltaWeight)) {
          this.logger.log(
            this.i18n.t('logging.inference.balanceRecommendation.skip_rebalance_band', {
              args: {
                symbol: inference.symbol,
                targetWeight,
                currentWeight,
                deltaWeight,
                requiredBand: this.getRebalanceBand(targetWeight),
              },
            }),
          );
          return null;
        }

        // 예상 거래비용(수수료+슬리피지)보다 작은 조정은 생략
        if (!this.passesCostGate(deltaWeight)) {
          this.logger.log(
            this.i18n.t('logging.inference.balanceRecommendation.skip_cost_gate', {
              args: {
                symbol: inference.symbol,
                deltaWeight,
                minEdge: (this.ESTIMATED_FEE_RATE + this.ESTIMATED_SLIPPAGE_RATE) * this.COST_GUARD_MULTIPLIER,
              },
            }),
          );
          return null;
        }

        const diff = this.calculateRelativeDiff(targetWeight, currentWeight);
        if (!Number.isFinite(diff) || Math.abs(diff) < Number.EPSILON) {
          return null;
        }

        this.logger.log(
          this.i18n.t('logging.inference.balanceRecommendation.trade_delta', {
            args: {
              symbol: inference.symbol,
              targetWeight,
              currentWeight,
              deltaWeight,
              diff,
            },
          }),
        );

        if (diff < 0 && !this.isSellAmountSufficient(inference.symbol, diff, tradableMarketValueMap)) {
          return null;
        }

        const tradeRequest: TradeRequest = {
          symbol: inference.symbol,
          diff,
          balances,
          marketPrice,
          inference,
        };

        return tradeRequest;
      })
      .filter((item): item is TradeRequest => item !== null)
      .sort((a, b) => a.diff - b.diff); // 오름차순으로 정렬 (차이가 작은 것부터 처리)

    return tradeRequests;
  }

  /**
   * 편출 거래 요청 생성
   *
   * - 편출 대상 종목들에 대한 매도 거래 요청을 생성합니다.
   * - 편입 상한(count)을 초과한 종목과 intensity <= 0 종목을 전량 매도 대상으로 처리합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @param count 편입할 최대 종목 수
   * @returns 편출 거래 요청 목록
   */
  private generateExcludedTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    count: number,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    // 편출 대상 종목 선정:
    // 1. 편입 대상 중 count개를 초과한 종목들 (slice(count))
    // 2. intensity <= 0 && hasStock인 종목들
    const filteredBalanceRecommendations = [
      ...this.filterIncludedBalanceRecommendations(inferences).slice(count),
      ...this.filterExcludedBalanceRecommendations(inferences),
    ];

    // 편출 거래 요청 생성: 모두 완전 매도(diff: -1)
    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations
      .filter(
        (inference) =>
          this.isOrderableSymbol(inference.symbol, orderableSymbols) &&
          this.isSellAmountSufficient(inference.symbol, -1, tradableMarketValueMap),
      )
      .map((inference) => ({
        symbol: inference.symbol,
        diff: -1, // -1은 완전 매도를 의미
        balances,
        marketPrice,
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

  private toPercent(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) {
      return '-';
    }

    return `${Math.floor(value * 100)}%`;
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
    const previousMetrics = await this.buildPreviousMetricsMap(items);

    // 각 종목에 대한 실시간 API 호출을 병렬로 처리
    const inferenceResults = await Promise.all(
      items.map((item) => {
        return this.errorService.retryWithFallback(async () => {
          const { messages, marketFeatures } = await this.buildBalanceRecommendationMessages(item.symbol);

          const requestConfig = {
            ...UPBIT_BALANCE_RECOMMENDATION_CONFIG,
            text: {
              format: {
                type: 'json_schema' as const,
                name: 'balance_recommendation',
                strict: true,
                schema: UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA as Record<string, unknown>,
              },
            },
          };

          // 실시간 API 호출 (Responses API + web_search)
          const response = await this.openaiService.createResponse(messages, requestConfig);
          const outputText = this.openaiService.getResponseOutputText(response);
          if (!outputText || outputText.trim() === '') {
            return null;
          }
          const responseData = JSON.parse(outputText);
          const intensity = Number(responseData?.intensity);
          const safeIntensity = Number.isFinite(intensity) ? intensity : 0;
          const modelSignals = this.calculateModelSignals(safeIntensity, item.category, marketFeatures, item.symbol);
          const previousMetricsBySymbol = previousMetrics.get(item.symbol);

          // 추론 결과와 아이템 병합
          return {
            ...responseData,
            intensity: safeIntensity,
            category: item?.category,
            hasStock: item?.hasStock || false,
            prevIntensity: previousMetricsBySymbol?.intensity ?? null,
            prevModelTargetWeight: previousMetricsBySymbol?.modelTargetWeight ?? null,
            weight: item?.weight,
            confidence: item?.confidence,
            buyScore: modelSignals.buyScore,
            sellScore: modelSignals.sellScore,
            modelTargetWeight: modelSignals.modelTargetWeight,
            action: modelSignals.action,
          };
        });
      }),
    );

    const validResults = inferenceResults.filter((r): r is NonNullable<typeof r> => r != null);

    // 추론 결과가 없으면 빈 배열 반환
    if (validResults.length === 0) {
      this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.complete'));
      return [];
    }

    // 결과 저장
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.presave', { args: { count: validResults.length } }),
    );

    const batchId = randomUUID();
    const recommendationResults = await Promise.all(
      validResults.map((recommendation) => this.saveBalanceRecommendation({ ...recommendation, batchId })),
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
      intensity: saved.intensity,
      prevIntensity: saved.prevIntensity != null ? Number(saved.prevIntensity) : null,
      prevModelTargetWeight: validResults[index].prevModelTargetWeight ?? null,
      buyScore: saved.buyScore,
      sellScore: saved.sellScore,
      modelTargetWeight: saved.modelTargetWeight,
      action: saved.action,
      hasStock: validResults[index].hasStock,
      weight: validResults[index].weight,
      confidence: validResults[index].confidence,
    }));
  }

  /**
   * 포트폴리오 분석 메시지 빌드
   *
   * - 뉴스, 공포탐욕지수, 이전 추론, 개별 종목 특성 데이터를 포함한 프롬프트를 구성합니다.
   *
   * @param symbol 종목 심볼
   * @returns OpenAI API용 메시지 배열과 score 계산용 feature
   */
  private async buildBalanceRecommendationMessages(
    symbol: string,
  ): Promise<{ messages: EasyInputMessage[]; marketFeatures: MarketFeatures | null }> {
    const messages: EasyInputMessage[] = [];

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

    return { messages, marketFeatures };
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
   * 최신 이전 추론 데이터 가져오기
   *
   * - 기간 제한 없이 가장 최근 추론 1건을 조회합니다.
   *
   * @param symbol 종목 심볼
   * @returns 이전 추론 결과 배열 (최대 1건)
   */
  private async fetchRecentRecommendations(symbol: string): Promise<BalanceRecommendation[]> {
    const operation = () =>
      BalanceRecommendation.find({
        where: { symbol },
        order: { createdAt: 'DESC' },
        take: 1,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.recent_recommendations_failed'), error);
      return [];
    }
  }

  private async buildPreviousMetricsMap(
    items: RecommendationItem[],
  ): Promise<Map<string, { intensity: number | null; modelTargetWeight: number | null }>> {
    const symbols = Array.from(new Set(items.map((item) => item.symbol)));
    const previousMetrics = await Promise.all(
      symbols.map(async (symbol) => {
        const recentRecommendations = await this.fetchRecentRecommendations(symbol);
        const latestRecommendation = recentRecommendations[0];
        const latestIntensity =
          latestRecommendation?.intensity != null && Number.isFinite(latestRecommendation.intensity)
            ? Number(latestRecommendation.intensity)
            : null;
        const latestModelTargetWeight =
          latestRecommendation?.modelTargetWeight != null && Number.isFinite(latestRecommendation.modelTargetWeight)
            ? Number(latestRecommendation.modelTargetWeight)
            : null;

        return [
          symbol,
          {
            intensity: latestIntensity,
            modelTargetWeight: latestModelTargetWeight,
          },
        ] as const;
      }),
    );

    return new Map(previousMetrics);
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
