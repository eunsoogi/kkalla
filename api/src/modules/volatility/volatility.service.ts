import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';

import { HistoryService } from '@/modules/history/history.service';
import { BalanceRecommendationData, RecommendationItem } from '@/modules/inference/inference.interface';
import { InferenceService } from '@/modules/inference/inference.service';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { User } from '@/modules/user/entities/user.entity';

import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { TradeService } from '../trade/trade.service';
import { SymbolVolatility } from './volatility.interface';

/**
 * 마켓 변동성 감시 모듈의 핵심 서비스.
 *
 * - `HistoryService` 에 저장된 종목 목록을 기준으로, 각 종목의 1분봉 캔들을 주기적으로 조회한다.
 * - 최근 6개의 1분봉을 사용해 5분 윈도우 2개(이전 5분, 현재 5분)의 변동폭을 계산한다.
 * - 변동폭을 5%p(기본 0.05) 단위 버킷으로 나눈 뒤, 이전 버킷보다 큰 버킷으로 진입한 경우에만
 *   변동성이 증가했다고 판단하고 잔고 추천 추론 및 Slack 알림을 트리거한다.
 * - 동시 실행 방지를 위해 Redlock 기반 분산 락을 사용한다.
 */
@Injectable()
export class MarketVolatilityService {
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

  /**
   * @param historyService   잔고 추천 대상 종목 목록(히스토리)을 제공
   * @param upbitService     Upbit 1분봉 캔들 조회
   * @param inferenceService 변동성 증가 종목에 대한 잔고 추천 추론 실행
   * @param slackService     변동성 트리거 발생 시 서버 Slack 채널로 알림 전송
   * @param tradeService     변동성 감지 시 실제 거래 실행
   * @param scheduleService  스케줄 활성화된 사용자 목록 조회
   * @param i18n             i18n 기반 로그/알림 메시지 포맷팅
   */
  constructor(
    private readonly historyService: HistoryService,
    private readonly upbitService: UpbitService,
    private readonly inferenceService: InferenceService,
    private readonly slackService: SlackService,
    private readonly tradeService: TradeService,
    private readonly scheduleService: ScheduleService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * 매 분 실행되는 마켓 변동성 체크 cron.
   *
   * - `@Cron(EVERY_MINUTE)` 로 1분마다 실행된다.
   * - `@WithRedlock` 으로 동일 리소스에 대한 중복 실행을 방지한다.
   * - 실제 비즈니스 로직은 `checkMarketVolatility` 로 위임한다.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  @WithRedlock({ duration: 30_000 })
  public async handleTick(): Promise<void> {
    await this.checkMarketVolatility();
  }

  /**
   * cron에서 호출되는 메인 변동성 체크 함수.
   *
   * - 히스토리 종목 목록을 가져와 각 종목별 변동성을 계산한다.
   * - 버킷이 증가한(새로운 5%p 변동 구간에 진입한) 종목만 수집한다.
   * - 변동성이 감지된 종목들에 대해 잔고 추천 추론 및 Slack 알림을 트리거한다.
   */
  private async checkMarketVolatility(): Promise<void> {
    // 잔고 추천 대상(히스토리) 종목 목록을 조회
    const historyItems = await this.historyService.fetchHistory();

    if (!historyItems.length) {
      // 감시할 종목이 없으면 조용히 종료
      this.logger.debug(this.i18n.t('logging.market.volatility.no_history'));
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
   * BTC/KRW 변동성 감지 시 전체 재추론 트리거.
   *
   * - 1%p 단위 버킷 증가를 감지했을 때 history 전체에 대해 잔고 추천을 수행한다.
   * - 추론 결과를 바탕으로 스케줄 활성화된 사용자들에 대해 실제 거래를 실행한다.
   * - 기존 보유 종목은 매도하지 않고, 추론된 종목만 거래한다.
   * - 트리거 발생 여부를 boolean 으로 반환한다.
   */
  private async triggerBtcVolatility(historyItems: RecommendationItem[]): Promise<boolean> {
    const btcVolatility = await this.calculateSymbolVolatility(this.BTC_SYMBOL, this.BTC_VOLATILITY_BUCKET_STEP);

    if (!btcVolatility?.triggered) {
      return false;
    }

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
    const inferences: BalanceRecommendationData[] = await this.inferenceService.balanceRecommendation(historyItems);

    // 스케줄 활성화된 사용자 목록 조회
    const users: User[] = await this.scheduleService.getUsers();

    if (users.length === 0) {
      this.logger.debug(this.i18n.t('logging.market.volatility.no_users'));
    } else {
      // SQS를 통해 변동성 감지 메시지 전송 (동시 처리 방지)
      await this.tradeService.produceMessageForVolatility(users, inferences, true);
    }

    return true;
  }

  /**
   * 개별 종목 변동성 기반 트리거.
   *
   * - 히스토리 종목 각각에 대해 5%p 단위 변동 버킷 증가 여부를 확인한다.
   * - 변동성이 감지된 종목들만 모아 `triggerVolatility` 를 호출한다.
   *
   * @returns 하나 이상의 종목에서 변동성이 감지되어 트리거가 발생했는지 여부
   */
  private async triggerPerSymbolVolatility(historyItems: RecommendationItem[]): Promise<boolean> {
    // 심볼 → RecommendationItem 맵 구성 (나중에 변동성 있는 심볼을 RecommendationItem 으로 복원하기 위함)
    const symbolToItem = new Map<string, RecommendationItem>();
    historyItems.forEach((item) => {
      symbolToItem.set(item.symbol, item);
    });

    // 각 종목에 대한 변동성 검사 결과를 모아, 변동성이 감지된 종목만 반환
    const volatileItems = (
      await Promise.all(
        historyItems.map(async (item) => {
          const { symbol } = item;

          try {
            // 개별 종목에 대한 변동성 계산 (기본 5% step)
            const volatility = await this.calculateSymbolVolatility(symbol);
            if (!volatility) {
              return null;
            }

            const { triggered, prevPercent, currPercent, prevBucket, currBucket } = volatility;

            // 버킷이 증가하지 않았다면(새로운 5%p 구간에 진입하지 않았다면) 스킵
            if (!triggered) {
              return null;
            }

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
   * 종목 하나에 대한 변동성 계산.
   *
   * - Upbit에서 최근 1분봉 6개를 조회한다.
   * - 앞의 5개: "이전 5분" 윈도우, 뒤의 5개: "현재 5분" 윈도우로 사용한다.
   * - 각 윈도우에 대해 최고 종가 / 최저 종가를 이용해 변동폭 비율
   *   \((maxClose - minClose) / minClose\) 을 계산한다.
   * - 변동폭 비율을 `STEP_PERCENT` (0.05) 로 나눠 버킷 인덱스를 구하고,
   *   현재 버킷이 이전 버킷보다 클 경우에만 `triggered = true` 로 판단한다.
   * - 캔들이 부족하거나, 계산 불가능한 값이 포함되어 있으면 `null` 을 반환해
   *   해당 심볼을 이번 틱에서 건너뛴다.
   */
  private async calculateSymbolVolatility(
    symbol: string,
    stepPercent: number = this.VOLATILITY_BUCKET_STEP,
  ): Promise<SymbolVolatility | null> {
    // 최근 6개의 1분봉 캔들을 조회 (이전 5분 + 현재 5분 윈도우 구성용)
    const candles = await this.upbitService.getRecentMinuteCandles(symbol, 6);

    if (!candles || candles.length < 6) {
      this.logger.debug(this.i18n.t('logging.market.volatility.not_enough_candles', { args: { symbol } }));
      return null;
    }

    // 앞의 5개는 "이전 5분", 뒤의 5개는 "현재 5분" 윈도우
    const prevWindow = candles.slice(0, 5);
    const nextWindow = candles.slice(1, 6);

    // 각 윈도우의 종가 기준 변동폭 비율 계산
    const prevPercent = this.calculateWindowVolatilityPercent(prevWindow);
    const currPercent = this.calculateWindowVolatilityPercent(nextWindow);

    // 계산 불가능한 값이 포함된 경우 스킵
    if (prevPercent < 0 || currPercent < 0) {
      return null;
    }

    // prevPercent, currPercent는 0~1 범위의 비율 값이므로, stepPercent로 나눠 버킷 인덱스를 계산
    const prevBucketIndex = Math.floor(prevPercent / stepPercent);
    const currBucketIndex = Math.floor(currPercent / stepPercent);

    const triggered = currBucketIndex > prevBucketIndex;
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
   * 변동성 감지 시 잔고 추천 및 Slack 알림을 트리거.
   *
   * - 변동성이 감지된 종목이 없으면 로그만 남기고 조용히 종료한다.
   * - 심볼 기준으로 중복을 제거한 뒤, 해당 심볼들에 대해
   *   `InferenceService.balanceRecommendation` 을 호출해 추론을 수행한다.
   * - 추론 결과를 바탕으로 스케줄 활성화된 사용자들에 대해 실제 거래를 실행한다.
   * - 기존 보유 종목은 매도하지 않고, 감지된 종목만 거래한다.
   * - 동시에 서버 Slack 채널로, 어떤 심볼들이 새로운 변동 구간에 진입했는지 알리는
   *   시스템 알림 메시지를 전송한다.
   *
   * @returns 변동성이 감지되어 실제로 트리거가 발생했는지 여부
   */
  private async triggerVolatility(volatileItems: RecommendationItem[]): Promise<boolean> {
    if (!volatileItems.length) {
      // 변동성이 감지된 종목이 없다면 아무 작업도 하지 않음
      this.logger.debug(this.i18n.t('logging.market.volatility.no_trigger'));
      return false;
    }

    // 중복 종목 제거
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
    const inferences: BalanceRecommendationData[] =
      await this.inferenceService.balanceRecommendation(uniqueChangedItems);

    // 스케줄 활성화된 사용자 목록 조회
    const users: User[] = await this.scheduleService.getUsers();

    if (users.length === 0) {
      this.logger.debug(this.i18n.t('logging.market.volatility.no_users'));
    } else {
      // SQS를 통해 변동성 감지 메시지 전송 (동시 처리 방지)
      await this.tradeService.produceMessageForVolatility(users, inferences, true);
    }

    // 변동성이 발생한 심볼 목록을 Slack 서버 채널로 알림 전송
    const symbolsText = uniqueChangedItems.map((item) => `> ${item.symbol}`).join('\n');
    await this.slackService.sendServer({
      message: this.i18n.t('notify.volatility.result', {
        args: { symbols: symbolsText },
      }),
    });

    return true;
  }

  /**
   * 캔들 배열에서 최저가/최고가를 이용해 변동폭 비율((maxClose - minClose) / minClose)을 계산.
   * candles: [timestamp, open, high, low, close, volume]
   *
   * - 종가 기준으로만 변동폭을 계산한다.
   * - 데이터가 부족하거나 0/NaN 등이 포함된 경우에는 `-1` 을 반환해
   *   상위 로직에서 해당 윈도우를 무시하도록 한다.
   */
  private calculateWindowVolatilityPercent(candles: any[]): number {
    if (!candles || candles.length === 0) {
      return -1;
    }

    // 각 캔들의 종가만 추출
    const closes = candles.map((candle) => candle[4]);

    // 5분 구간 내 최저/최고 종가 계산
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);

    // 0 또는 NaN 등이 섞여 있으면 계산 불가 처리
    if (!Number.isFinite(minClose) || !Number.isFinite(maxClose) || minClose <= 0) {
      return -1;
    }

    // 변동폭 비율 (예: 5% → 0.05)
    return (maxClose - minClose) / minClose;
  }
}
