import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Message, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Balances } from 'ccxt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import {
  AllocationRecommendationAction,
  AllocationRecommendationData,
  CategoryExposureCaps,
  QueueTradeExecutionMessageV2,
  RecommendationItem,
  TradeExecutionMessageV2,
} from '@/modules/allocation-core/allocation-core.types';
import { AllocationSlotService } from '@/modules/allocation-core/allocation-slot.service';
import { toPercentString } from '@/modules/allocation-core/helpers/allocation-recommendation';
import { TradeOrchestrationService } from '@/modules/allocation-core/trade-orchestration.service';
import { CacheService } from '@/modules/cache/cache.service';
import { ErrorService } from '@/modules/error/error.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { HoldingLedgerService } from '@/modules/holding-ledger/holding-ledger.service';
import { NewsService } from '@/modules/news/news.service';
import { toUserFacingText } from '@/modules/openai/openai-citation.util';
import { OpenaiService } from '@/modules/openai/openai.service';
import { createSharedSqsClient } from '@/modules/trade-execution-ledger/helpers/sqs-client';
import { startSqsConsumer } from '@/modules/trade-execution-ledger/helpers/sqs-consumer';
import { readStringValue, stringifyUnknownError } from '@/modules/trade-execution-ledger/helpers/sqs-message';
import { isNonRetryableExecutionError } from '@/modules/trade-execution-ledger/helpers/sqs-processing';
import { markMalformedMessageAsNonRetryable } from '@/modules/trade-execution-ledger/helpers/trade-execution-malformed';
import { parseQueuedInference } from '@/modules/trade-execution-ledger/helpers/trade-execution-message';
import { parseTradeExecutionMessage } from '@/modules/trade-execution-ledger/helpers/trade-execution-parser';
import { processTradeExecutionMessage } from '@/modules/trade-execution-ledger/helpers/trade-execution-pipeline';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { User } from '@/modules/user/entities/user.entity';
import { generateMonotonicUlid } from '@/utils/id';
import { formatNumber } from '@/utils/number';
import { normalizeKrwSymbol } from '@/utils/symbol';

import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { AllocationRecommendation } from '../allocation/entities/allocation-recommendation.entity';
import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { MarketRegimeService } from '../market-regime/market-regime.service';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { TradeExecutionModule } from '../trade-execution-ledger/trade-execution-ledger.enum';
import { TradeExecutionLedgerService } from '../trade-execution-ledger/trade-execution-ledger.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeRequest } from '../trade/trade.types';
import { MarketFeatures } from '../upbit/upbit.types';
import { UserService } from '../user/user.service';
import { SymbolVolatility } from './market-risk.types';
import {
  UPBIT_ALLOCATION_RECOMMENDATION_CONFIG,
  UPBIT_ALLOCATION_RECOMMENDATION_PROMPT,
  UPBIT_ALLOCATION_RECOMMENDATION_RESPONSE_SCHEMA,
} from './prompts/allocation-recommendation.prompt';

/**
 * 마켓 변동성 감시 모듈의 핵심 서비스.
 *
 * - `HoldingLedgerService` 에 저장된 종목 목록을 기준으로, 각 종목의 1분봉 캔들을 주기적으로 조회한다.
 * - 최근 11개의 1분봉을 사용해 10분 윈도우 2개(이전 10분, 현재 10분)의 변동폭을 계산한다.
 * - 변동폭을 5%p(기본 0.05) 단위 버킷으로 나눈 뒤, 이전 버킷보다 큰 버킷으로 진입한 경우에만
 *   변동성이 증가했다고 판단하고 잔고 추천 추론 및 Slack 알림을 트리거한다.
 * - 동시 실행 방지를 위해 Redlock 기반 분산 락을 사용한다.
 */
@Injectable()
export class MarketRiskService implements OnModuleInit {
  private readonly logger = new Logger(MarketRiskService.name);
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
   * - BTC/KRW는 더 민감하게(1% 단위) 변동성을 감지해 자산 배분 전체 재추론 트리거에 사용한다.
   */
  private readonly BTC_VOLATILITY_BUCKET_STEP = 0.01;
  private readonly BTC_SYMBOL = 'BTC/KRW';
  private readonly VOLATILITY_DIRECTION_THRESHOLD = 0.01;
  private readonly VOLATILITY_SYMBOL_COOLDOWN_SECONDS = 1_800;
  private readonly BTC_VOLATILITY_COOLDOWN_SECONDS = 3_600;

  // Amazon SQS
  private readonly sqs = createSharedSqsClient();

  private readonly queueUrl = process.env.AWS_SQS_QUEUE_URL_MARKET_RISK;
  private readonly acceptedLegacyQueueModules = ['volatility'];
  private readonly outboundQueueModuleLabel = 'risk' as const;

  /**
   * @param holdingLedgerService   잔고 추천 대상 종목 목록(자산 배분)을 제공
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
    private readonly holdingLedgerService: HoldingLedgerService,
    private readonly upbitService: UpbitService,
    private readonly slackService: SlackService,
    private readonly cacheService: CacheService,
    private readonly scheduleService: ScheduleService,
    private readonly categoryService: CategoryService,
    private readonly allocationSlotService: AllocationSlotService,
    private readonly tradeOrchestrationService: TradeOrchestrationService,
    private readonly notifyService: NotifyService,
    private readonly profitService: ProfitService,
    private readonly i18n: I18nService,
    private readonly newsService: NewsService,
    private readonly marketRegimeService: MarketRegimeService,
    private readonly openaiService: OpenaiService,
    private readonly featureService: FeatureService,
    private readonly errorService: ErrorService,
    private readonly allocationAuditService: AllocationAuditService,
    private readonly userService: UserService,
    private readonly redlockService: RedlockService,
    private readonly tradeExecutionLedgerService: TradeExecutionLedgerService,
  ) {
    if (!this.queueUrl) {
      throw new Error('AWS_SQS_QUEUE_URL_MARKET_RISK environment variable is required');
    }
  }

  /**
   * 모듈 초기화 시 SQS Consumer 시작
   */
  onModuleInit(): void {
    startSqsConsumer({
      sqs: this.sqs,
      queueUrl: this.queueUrl,
      logger: this.logger,
      messages: {
        onStart: this.i18n.t('logging.sqs.consumer.start'),
        onRestart: this.i18n.t('logging.sqs.consumer.restart'),
        onError: (error) => this.i18n.t('logging.sqs.consumer.error', { args: { error } }),
        onProcessing: (count) =>
          this.i18n.t('logging.sqs.consumer.processing', {
            args: { count },
          }),
      },
      onMessage: (message) => this.handleMessage(message),
    });
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
    const processingHeartbeatIntervalMs = this.tradeOrchestrationService.getProcessingHeartbeatIntervalMs();
    const messageTtlMs = this.tradeOrchestrationService.getMessageTtlMs();
    const userTradeLockDurationMs = this.tradeOrchestrationService.getUserTradeLockDurationMs();
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));
    await processTradeExecutionMessage<TradeExecutionMessageV2>({
      module: TradeExecutionModule.RISK,
      message,
      sqs: this.sqs,
      queueUrl: this.queueUrl,
      heartbeatIntervalMs: processingHeartbeatIntervalMs,
      parseMessage: (messageBody) => this.parseVolatilityMessage(messageBody),
      onMalformedMessage: async (targetMessage, error) => {
        await markMalformedMessageAsNonRetryable(
          {
            message: targetMessage,
            module: TradeExecutionModule.RISK,
            messageTtlMs,
            sqs: this.sqs,
            queueUrl: this.queueUrl,
            ledgerService: this.tradeExecutionLedgerService,
            resolveUserId: (parsed) => readStringValue(parsed, 'userId') ?? 'unknown',
          },
          error,
        );
        this.logger.warn(
          this.i18n.t('logging.sqs.message.dropped_malformed', {
            args: {
              module: TradeExecutionModule.RISK,
              error: stringifyUnknownError(error),
            },
          }),
        );
      },
      ledgerService: this.tradeExecutionLedgerService,
      withUserLock: (userId, callback) =>
        this.redlockService.withLock(`trade:user:${userId}`, userTradeLockDurationMs, callback),
      executeLocked: async (parsedMessage, assertLockOrThrow) => {
        assertLockOrThrow();
        const user = await this.userService.findById(parsedMessage.userId);
        assertLockOrThrow();
        const trades = await this.executeVolatilityTradesForUser(user, parsedMessage.inferences, assertLockOrThrow);
        assertLockOrThrow();

        this.logger.debug(
          this.i18n.t('logging.sqs.message.executed_trades_debug', {
            args: {
              module: TradeExecutionModule.RISK,
              messageKey: parsedMessage.messageKey,
              count: trades.length,
            },
          }),
        );

        if (trades.length > 0) {
          assertLockOrThrow();
          const profitData = await this.profitService.getProfit(user);
          assertLockOrThrow();
          await this.notifyService.notify(
            user,
            this.i18n.t('notify.profit.result', {
              args: {
                profit: formatNumber(profitData.profit),
              },
            }),
          );
        }
      },
      isNonRetryableExecutionError,
      onSkippedProcessing: (messageKey) => {
        this.logger.warn(
          this.i18n.t('logging.sqs.message.skipped_processing', {
            args: {
              module: TradeExecutionModule.RISK,
              messageKey,
            },
          }),
        );
      },
      onVisibilityExtendFailed: (targetMessage, error) => {
        this.logger.warn(
          this.i18n.t('logging.sqs.message.visibility_extend_failed', {
            args: {
              id: targetMessage.MessageId ?? 'unknown',
            },
          }),
          error,
        );
      },
      onHeartbeatFailed: (context, error) => {
        this.logger.warn(
          this.i18n.t('logging.sqs.message.ledger_heartbeat_failed', {
            args: {
              module: context.module,
              messageKey: context.messageKey,
              userId: context.userId,
            },
          }),
          error,
        );
      },
      onComplete: (id) => {
        this.logger.log(this.i18n.t('logging.sqs.message.complete', { args: { id } }));
      },
      onError: (id, error) => {
        this.logger.error(
          this.i18n.t('logging.sqs.message.error', {
            args: { id, error },
          }),
        );
      },
    });
  }

  /**
   * Parses volatility message for the market risk flow.
   * @param messageBody - Message payload handled by the market risk flow.
   * @returns Result produced by the market risk flow.
   */
  private parseVolatilityMessage(messageBody: string | undefined): TradeExecutionMessageV2 {
    return parseTradeExecutionMessage({
      module: TradeExecutionModule.RISK,
      moduleLabel: 'risk',
      queueMessageVersion: this.tradeOrchestrationService.getQueueMessageVersion(),
      messageBody,
      acceptedModuleAliases: this.acceptedLegacyQueueModules,
      parseInference: parseQueuedInference,
    });
  }

  /**
   * 매 분 실행되는 마켓 리스크 체크 스케줄
   *
   * - 매 분마다 실행되어 시장 변동성을 감시합니다.
   * - Redlock을 사용하여 동일 리소스에 대한 중복 실행을 방지합니다.
   * - 실제 리스크 체크 로직은 `checkMarketRiskEvents`로 위임합니다.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  @WithRedlock({
    resourceName: 'MarketRiskService:handleTick',
    compatibleResourceNames: ['MarketVolatilityService:handleTick'],
    duration: 30_000,
  })
  public async handleTick(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    // 시장 리스크 체크 실행
    await this.checkMarketRiskEvents();
  }

  /**
   * 시장 리스크 체크 메인 함수
   *
   * - 자산 배분 종목 목록을 가져와 각 종목별 변동성을 계산합니다.
   * - BTC/KRW 변동성을 먼저 확인하여 전체 재추론 여부를 판단합니다.
   * - BTC 변동성이 없으면 개별 종목 변동성을 확인합니다.
   * - 버킷이 증가한(새로운 변동 구간에 진입한) 종목만 수집하여 처리합니다.
   */
  private async checkMarketRiskEvents(): Promise<void> {
    const users: User[] = await this.scheduleService.getUsers();
    if (users.length === 0) {
      this.logger.log(this.i18n.t('logging.market.risk.no_users'));
      return;
    }

    // 잔고 추천 대상(자산 배분) 종목 목록을 조회
    const holdingItems = await this.holdingLedgerService.fetchHoldingsByUsers(users);

    if (!holdingItems.length) {
      // 감시할 종목이 없으면 조용히 종료
      this.logger.log(this.i18n.t('logging.market.risk.no_holdings'));
      return;
    }

    // 1. BTC/KRW 변동성(1% 단위)을 먼저 확인해, 글로벌 재추론 트리거 여부를 판단
    const isBtcTriggered = await this.triggerBtcVolatility(holdingItems, users);

    // BTC 변동성이 감지됐다면: 전체 재추론만 수행하고, 개별 종목 변동성 검사는 생략
    if (isBtcTriggered) {
      return;
    }

    // 2. BTC 변동성이 감지되지 않았다면, 개별 종목 변동성을 기준으로 트리거를 검사
    await this.triggerPerSymbolVolatility(holdingItems, users);
  }

  /**
   * BTC/KRW 변동성 감지 시 전체 재추론 트리거
   *
   * - BTC/KRW는 1% 단위로 변동성을 감지하여 더 민감하게 반응합니다.
   * - 1%p 단위 버킷 증가를 감지하면 보유 종목 전체에 대해 잔고 추천을 수행합니다.
   * - 추론 결과를 바탕으로 스케줄 활성화된 사용자들에 대해 실제 거래를 실행합니다.
   * - 기존 보유 종목은 매도하지 않고, 추론된 종목만 거래합니다.
   * - BTC 변동성이 감지되면 개별 종목 리스크 체크는 생략합니다.
   *
   * @param holdingItems 자산 배분 종목 목록
   * @returns 변동성이 감지되어 트리거가 발생했는지 여부
   */
  private async triggerBtcVolatility(holdingItems: RecommendationItem[], users: User[]): Promise<boolean> {
    let btcVolatility: SymbolVolatility | null;

    try {
      // BTC/KRW 변동성 계산 (1% 단위로 더 민감하게 감지)
      btcVolatility = await this.calculateSymbolVolatility(this.BTC_SYMBOL, this.BTC_VOLATILITY_BUCKET_STEP);
    } catch (error) {
      // BTC 변동성 계산 오류는 전체 흐름을 깨지 않고 로그만 남김
      // 개별 심볼 체크가 계속 진행될 수 있도록 false 반환
      this.logger.error(this.i18n.t('logging.market.risk.check_failed', { args: { symbol: this.BTC_SYMBOL } }), error);
      return false;
    }

    // 변동성이 감지되지 않았으면 false 반환
    if (!btcVolatility?.triggered) {
      return false;
    }

    // BTC는 시장 전체 트리거이므로 쿨다운을 길게 적용해 과도한 재추론 방지
    if (await this.isSymbolOnCooldown(this.BTC_SYMBOL)) {
      // 글로벌 BTC 트리거는 건너뛰고, 개별 종목 리스크 체크는 계속 진행한다.
      return false;
    }

    // 변동성 정보를 퍼센트 문자열로 변환 (로그용)
    const prevPercentText = ((btcVolatility.prevPercent ?? 0) * 100).toFixed(2);
    const currPercentText = ((btcVolatility.currPercent ?? 0) * 100).toFixed(2);
    const prevBucketPercentText = ((btcVolatility.prevBucket ?? 0) * 100).toFixed(0);
    const currBucketPercentText = ((btcVolatility.currBucket ?? 0) * 100).toFixed(0);

    this.logger.log(
      this.i18n.t('logging.market.risk.bucket_increased', {
        args: {
          symbol: this.BTC_SYMBOL,
          prevPercent: prevPercentText,
          currPercent: currPercentText,
          prevBucket: prevBucketPercentText,
          currBucket: currBucketPercentText,
        },
      }),
    );

    // BTC/KRW 변동성 증가 시: 보유 종목 전체 재추론
    // BTC는 시장 지표이므로 전체 자산 배분 재조정
    const inferences: AllocationRecommendationData[] = await this.allocationRecommendation(holdingItems);

    // SQS를 통해 변동성 감지 메시지 전송 (동시 처리 방지)
    await this.publishVolatilityMessage(users, inferences);

    await this.markSymbolOnCooldown(this.BTC_SYMBOL, this.BTC_VOLATILITY_COOLDOWN_SECONDS);

    // BTC 변동성이 발생했음을 Slack 서버 채널로 알림 전송
    const btcThreshold = (this.BTC_VOLATILITY_BUCKET_STEP * 100).toFixed(0);
    await this.slackService.sendServer({
      message: this.i18n.t('notify.risk.result', {
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
   * - 자산 배분 종목 각각에 대해 5%p 단위 변동 버킷 증가 여부를 확인합니다.
   * - 각 종목의 변동성을 병렬로 계산하여 성능을 최적화합니다.
   * - 변동성이 감지된 종목들만 모아 `triggerVolatility`를 호출합니다.
   *
   * @param holdingItems 자산 배분 종목 목록
   * @returns 하나 이상의 종목에서 변동성이 감지되어 트리거가 발생했는지 여부
   */
  private async triggerPerSymbolVolatility(holdingItems: RecommendationItem[], users: User[]): Promise<boolean> {
    // 심볼 → RecommendationItem 맵 구성 (나중에 변동성 있는 심볼을 RecommendationItem 으로 복원하기 위함)
    const symbolToItem = new Map<string, RecommendationItem>();
    holdingItems.forEach((item) => {
      symbolToItem.set(item.symbol, item);
    });

    // 각 종목에 대한 변동성 검사 결과를 모아, 변동성이 감지된 종목만 반환
    // 병렬 처리로 성능 최적화
    const volatileItems = (
      await Promise.all(
        holdingItems.map(async (item) => {
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
              this.i18n.t('logging.market.risk.bucket_increased', {
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
            // 다른 종목들의 리스크 체크는 계속 진행
            this.logger.error(this.i18n.t('logging.market.risk.check_failed', { args: { symbol } }), error);
            return null;
          }
        }),
      )
    ).filter((item): item is RecommendationItem => !!item);

    // 변동성이 감지된 종목들에 대해 후처리(추론/Slack 알림) 실행
    return this.triggerVolatility(volatileItems, users);
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
      this.logger.log(this.i18n.t('logging.market.risk.not_enough_candles', { args: { symbol } }));
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
  private async triggerVolatility(volatileItems: RecommendationItem[], users: User[]): Promise<boolean> {
    // 변동성이 감지된 종목이 없다면 아무 작업도 하지 않음
    if (!volatileItems.length) {
      this.logger.log(this.i18n.t('logging.market.risk.no_trigger'));
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
      this.i18n.t('logging.market.risk.trigger_start', {
        args: { count: uniqueChangedItems.length },
      }),
    );

    // 변동성이 감지된 종목들에 대해 잔고 추천 추론 실행
    // 감지된 종목들만 대상으로 추론하여 자산 배분 조정
    const inferences: AllocationRecommendationData[] = await this.allocationRecommendation(uniqueChangedItems);

    // SQS를 통해 변동성 감지 메시지 전송 (동시 처리 방지)
    await this.publishVolatilityMessage(users, inferences);

    // 과매매 방지를 위해 트리거된 심볼에 쿨다운 부여
    await this.markSymbolsOnCooldown(uniqueChangedItems.map((item) => item.symbol));

    // 변동성이 발생한 심볼 목록을 Slack 서버 채널로 알림 전송
    const symbolsText = uniqueChangedItems.map((item) => `> ${item.symbol}`).join('\n');
    const threshold = (this.VOLATILITY_BUCKET_STEP * 100).toFixed(0);

    await this.slackService.sendServer({
      message: this.i18n.t('notify.risk.result', {
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
   */
  private async publishVolatilityMessage(users: User[], inferences: AllocationRecommendationData[]): Promise<void> {
    this.logger.log(
      this.i18n.t('logging.sqs.producer.start', {
        args: { count: users.length },
      }),
    );

    try {
      const queueMessageVersion = this.tradeOrchestrationService.getQueueMessageVersion();
      const messageTtlMs = this.tradeOrchestrationService.getMessageTtlMs();
      const runId = randomUUID();
      const generatedAt = new Date();
      const expiresAt = new Date(generatedAt.getTime() + messageTtlMs);

      // 각 사용자별로 변동성 거래 메시지 생성
      // 메시지 본문에 사용자 정보, 추론 결과 포함
      const messages = users.map(
        (user) =>
          new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify({
              version: queueMessageVersion,
              module: this.outboundQueueModuleLabel,
              runId,
              messageKey: `${runId}:${user.id}`,
              userId: user.id,
              generatedAt: generatedAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
              inferences,
            } satisfies QueueTradeExecutionMessageV2),
          }),
      );

      // 모든 메시지를 병렬로 전송 (성능 최적화)
      const results = await Promise.all(messages.map((message) => this.sqs.send(message)));
      this.logger.debug(
        this.i18n.t('logging.sqs.producer.send_results_debug', {
          args: {
            module: this.outboundQueueModuleLabel,
            count: results.length,
          },
        }),
      );
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
   * @returns 실행된 거래 목록
   */
  public async executeVolatilityTradesForUser(
    user: User,
    inferences: AllocationRecommendationData[],
    lockGuard?: (() => void) | boolean | null,
  ): Promise<Trade[]> {
    const assertLockOrThrow = typeof lockGuard === 'function' ? lockGuard : () => undefined;
    assertLockOrThrow();

    const holdingItems = await this.holdingLedgerService.fetchHoldingsByUser(user);
    const holdingScopedRecommendations = this.tradeOrchestrationService.applyHeldAssetFlags(inferences, holdingItems);
    assertLockOrThrow();

    // 권한이 있는 추천만 필터링: 사용자가 거래할 수 있는 카테고리만 포함
    const enabledCategories = await this.categoryService.findEnabledByUser(user);
    const authorizedRecommendations = this.tradeOrchestrationService.filterAuthorizedRecommendationItems(
      user,
      holdingScopedRecommendations,
      enabledCategories,
      (targetUser, category) => this.categoryService.checkCategoryPermission(targetUser, category),
    );
    assertLockOrThrow();

    // 권한이 있는 추천이 없으면 거래 불가
    if (authorizedRecommendations.length === 0) {
      return [];
    }

    // 변동성 감시는 보유 종목 기준이므로, 미보유 추천은 실행 대상에서 제외한다.
    const heldAllocationRecommendations = authorizedRecommendations.filter((recommendation) => recommendation.hasStock);
    if (heldAllocationRecommendations.length === 0) {
      return [];
    }

    // 추론 결과를 사용자에게 알림 전송 (종목별 추천 비율 표시)
    await this.notifyService.notify(
      user,
      this.i18n.t('notify.allocationRecommendation.result', {
        args: {
          transactions: heldAllocationRecommendations
            .map((recommendation) =>
              this.i18n.t('notify.allocationRecommendation.transaction', {
                args: {
                  symbol: recommendation.symbol,
                  prevModelTargetWeight: toPercentString(recommendation.prevModelTargetWeight),
                  modelTargetWeight: toPercentString(recommendation.modelTargetWeight),
                  reason: toUserFacingText(recommendation.reason ?? '') || '-',
                },
              }),
            )
            .join('\n\n'),
        },
      }),
    );
    assertLockOrThrow();

    // 유저 계좌 조회: 현재 보유 종목 및 잔고 정보
    const balances = await this.upbitService.getBalances(user);
    assertLockOrThrow();

    // 계좌 정보가 없으면 거래 불가
    if (!balances) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      return [];
    }

    // 전체 자산 배분 종목 수 계산 (전체 자산 배분 비율 유지를 위해 사용)
    const slotCount = await this.allocationSlotService.resolveAuthorizedSlotCount(user);
    assertLockOrThrow();

    // slotCount가 0이면 거래 불가
    if (slotCount === 0) {
      return [];
    }

    const referenceSymbols = heldAllocationRecommendations.map((inference) => inference.symbol);
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const executionSnapshot = await this.tradeOrchestrationService.buildTradeExecutionSnapshot({
      runtime: tradeRuntime,
      balances,
      referenceSymbols,
      assertLockOrThrow,
    });
    // 시장 상황에 따른 전체 익스포저 배율 (risk-on/risk-off)
    const regimePolicy = await this.tradeOrchestrationService.resolveMarketRegimePolicy(() =>
      this.errorService.retryWithFallback(() => this.marketRegimeService.getSnapshot()),
    );
    const regimeMultiplier = regimePolicy.exposureMultiplier;
    assertLockOrThrow();
    // 공통 오케스트레이션 서비스로 매도/매수/원장 반영/알림 흐름을 위임한다.
    return this.tradeOrchestrationService.executeRebalanceTrades({
      runtime: tradeRuntime,
      holdingLedgerService: this.holdingLedgerService,
      notifyService: this.notifyService,
      user,
      referenceSymbols,
      initialSnapshot: executionSnapshot,
      turnoverCap: regimePolicy.turnoverCap,
      assertLockOrThrow,
      buildExcludedRequests: (snapshot) =>
        this.generateExcludedTradeRequests(
          snapshot.balances,
          heldAllocationRecommendations,
          slotCount,
          snapshot.marketPrice,
          snapshot.orderableSymbols,
          snapshot.tradableMarketValueMap,
        ),
      buildIncludedRequests: (snapshot) =>
        this.generateIncludedTradeRequests(
          snapshot.balances,
          heldAllocationRecommendations,
          slotCount,
          regimeMultiplier,
          snapshot.currentWeights,
          snapshot.marketPrice,
          snapshot.orderableSymbols,
          snapshot.tradableMarketValueMap,
          regimePolicy.rebalanceBandMultiplier,
          regimePolicy.categoryExposureCaps,
        ),
      buildNoTradeTrimRequests: (snapshot) =>
        this.generateNoTradeTrimRequests(
          snapshot.balances,
          heldAllocationRecommendations,
          slotCount,
          regimeMultiplier,
          snapshot.currentWeights,
          snapshot.marketPrice,
          snapshot.orderableSymbols,
          snapshot.tradableMarketValueMap,
          regimePolicy.rebalanceBandMultiplier,
          regimePolicy.categoryExposureCaps,
        ),
    });
  }

  /**
   * Calculates model signal bundle and emits telemetry log for volatility-triggered runs.
   * @param intensity - Model intensity score.
   * @param category - Asset category.
   * @param marketFeatures - Optional market feature payload.
   * @param symbol - Optional symbol for logging.
   * @returns Model signal bundle (buy/sell score, target weight, action).
   */
  private calculateModelSignals(
    intensity: number,
    category: Category,
    marketFeatures: MarketFeatures | null,
    symbol?: string,
  ) {
    const { featureScore, buyScore, sellScore, modelTargetWeight, action } =
      this.tradeOrchestrationService.calculateModelSignals(intensity, marketFeatures);
    this.logger.log(
      this.i18n.t('logging.inference.allocationRecommendation.model_signal', {
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

  /**
   * Resolves final per-symbol target weight for risk rebalancing.
   * @param inference - Recommendation payload.
   * @param regimeMultiplier - Market-regime exposure multiplier.
   * @returns Final regime-adjusted target weight.
   */
  private calculateTargetWeight(inference: AllocationRecommendationData, regimeMultiplier: number): number {
    const baseTargetWeight =
      inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)
        ? this.tradeOrchestrationService.clampToUnitInterval(inference.modelTargetWeight)
        : this.calculateModelSignals(inference.intensity, inference.category, null, inference.symbol).modelTargetWeight;

    const modelTargetWeight = this.tradeOrchestrationService.calculateRegimeAdjustedTargetWeight(
      baseTargetWeight,
      regimeMultiplier,
    );
    if (modelTargetWeight <= 0) {
      return 0;
    }
    this.logger.log(
      this.i18n.t('logging.inference.allocationRecommendation.target_weight', {
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

  /**
   * Retrieves symbol cooldown key for the market risk flow.
   * @param symbol - Asset symbol to process.
   * @returns Formatted string output for the operation.
   */
  private getSymbolCooldownKey(symbol: string): string {
    return `market-risk:cooldown:${symbol}`;
  }

  /**
   * Checks symbol on cooldown in the market risk context.
   * @param symbol - Asset symbol to process.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  private async isSymbolOnCooldown(symbol: string): Promise<boolean> {
    try {
      return Boolean(await this.cacheService.get(this.getSymbolCooldownKey(symbol)));
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.market.risk.cooldown_read_failed', { args: { symbol } }), error);
      return false;
    }
  }

  /**
   * Runs symbols on cooldown in the market risk workflow.
   * @param symbols - Asset symbol to process.
   */
  private async markSymbolsOnCooldown(symbols: string[]): Promise<void> {
    await Promise.all(
      symbols.map((symbol) => this.markSymbolOnCooldown(symbol, this.VOLATILITY_SYMBOL_COOLDOWN_SECONDS)),
    );
  }

  /**
   * Runs symbol on cooldown in the market risk workflow.
   * @param symbol - Asset symbol to process.
   * @param ttlSeconds - Input value for ttl seconds.
   */
  private async markSymbolOnCooldown(symbol: string, ttlSeconds: number): Promise<void> {
    try {
      await this.cacheService.set(this.getSymbolCooldownKey(symbol), true, ttlSeconds);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.market.risk.cooldown_write_failed', { args: { symbol } }), error);
    }
  }

  private deriveTradeCostTelemetry(
    marketFeatures: MarketFeatures | null,
    expectedVolatilityPct: number,
    decisionConfidence: number,
  ): Pick<AllocationRecommendationData, 'expectedEdgeRate' | 'estimatedCostRate' | 'spreadRate' | 'impactRate'> {
    return this.tradeOrchestrationService.deriveTradeCostTelemetry(
      marketFeatures,
      expectedVolatilityPct,
      decisionConfidence,
    );
  }

  /**
   * Keeps only held items that pass included-recommendation policy filters.
   * @param inferences - Recommendation payloads.
   * @returns Held included recommendations.
   */
  private buildHeldIncludedRecommendationsByCategory(
    inferences: AllocationRecommendationData[],
  ): AllocationRecommendationData[] {
    return this.tradeOrchestrationService
      .filterIncludedRecommendations(inferences)
      .filter((inference) => inference.hasStock);
  }

  /**
   * Keeps only held items that should be treated as staged exits.
   * @param inferences - Recommendation payloads.
   * @returns Held excluded recommendations.
   */
  private buildHeldExcludedRecommendationsByCategory(
    inferences: AllocationRecommendationData[],
  ): AllocationRecommendationData[] {
    return this.tradeOrchestrationService
      .filterExcludedRecommendations(inferences)
      .filter((inference) => inference.hasStock);
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
   * @param count 전체 자산 배분 종목 수
   * @returns 편입 거래 요청 목록 (diff 오름차순 정렬)
   */
  private generateIncludedTradeRequests(
    balances: Balances,
    inferences: AllocationRecommendationData[],
    count: number,
    regimeMultiplier: number,
    currentWeights: Map<string, number>,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
    rebalanceBandMultiplier: number = 1,
    categoryExposureCaps?: CategoryExposureCaps,
  ): TradeRequest[] {
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const candidates = this.buildHeldIncludedRecommendationsByCategory(inferences).slice(0, count);
    // 공통 서비스의 편입 요청 계산을 사용해 allocation/risk sizing 규칙을 일치시킨다.
    return this.tradeOrchestrationService.buildIncludedTradeRequests({
      runtime: tradeRuntime,
      balances,
      candidates,
      targetSlotCount: count,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      calculateTargetWeight: (inference, targetRegimeMultiplier) =>
        this.calculateTargetWeight(inference, targetRegimeMultiplier),
      orderableSymbols,
      tradableMarketValueMap,
      rebalanceBandMultiplier,
      categoryExposureCaps,
    });
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
    inferences: AllocationRecommendationData[],
    count: number,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const includedAllocationRecommendations = this.buildHeldIncludedRecommendationsByCategory(inferences);

    // 편출 대상 종목 선정:
    // 1. 편입 대상 중 count개를 초과한 종목들 (slice(count))
    // 2. intensity <= 0 && hasStock인 종목들
    const filteredAllocationRecommendations = [
      ...includedAllocationRecommendations.slice(count),
      ...this.buildHeldExcludedRecommendationsByCategory(inferences),
    ];

    return this.tradeOrchestrationService.buildExcludedTradeRequests({
      runtime: tradeRuntime,
      balances,
      candidates: filteredAllocationRecommendations,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
    });
  }

  /**
   * Builds trim-down sell requests for held assets marked as `no_trade`.
   * @param balances - User balance snapshot.
   * @param inferences - Recommendation payloads.
   * @param count - Effective top-K denominator for target sizing.
   * @param regimeMultiplier - Market-regime exposure multiplier.
   * @param currentWeights - Current portfolio weight map.
   * @param marketPrice - Portfolio market value baseline.
   * @param orderableSymbols - Optional orderable symbol set.
   * @param tradableMarketValueMap - Optional per-symbol tradable market value map.
   * @param rebalanceBandMultiplier - Market-regime rebalance band multiplier.
   * @param categoryExposureCaps - Optional category exposure caps.
   * @returns No-trade trim sell requests for volatility flow.
   */
  private generateNoTradeTrimRequests(
    balances: Balances,
    inferences: AllocationRecommendationData[],
    count: number,
    regimeMultiplier: number,
    currentWeights: Map<string, number>,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
    rebalanceBandMultiplier: number = 1,
    categoryExposureCaps?: CategoryExposureCaps,
  ): TradeRequest[] {
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const candidates = inferences.filter(
      (inference) => inference.hasStock && this.tradeOrchestrationService.isNoTradeRecommendation(inference),
    );

    // Shared orchestrator applies identical diff/band/cost-gate rules as allocation flow.
    return this.tradeOrchestrationService.buildNoTradeTrimRequests({
      runtime: tradeRuntime,
      balances,
      candidates,
      topK: count,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      rebalanceBandMultiplier,
      categoryExposureCaps,
    });
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
  public async allocationRecommendation(items: RecommendationItem[]): Promise<AllocationRecommendationData[]> {
    this.logger.log(this.i18n.t('logging.inference.allocationRecommendation.start', { args: { count: items.length } }));
    const latestRecommendationMetricsBySymbol =
      await this.tradeOrchestrationService.buildLatestRecommendationMetricsMap({
        recommendationItems: items,
        errorService: this.errorService,
        onError: (error) => {
          this.logger.error(this.i18n.t('logging.inference.recent_recommendations_failed'), error);
        },
      });

    // 각 종목에 대한 실시간 API 호출을 병렬로 처리
    const inferenceResults = await Promise.all(
      items.map((item) => {
        return this.errorService.retryWithFallback(async () => {
          const targetSymbol =
            item.category === Category.NASDAQ ? item.symbol : (normalizeKrwSymbol(item.symbol) ?? item.symbol);
          if (targetSymbol !== item.symbol) {
            this.logger.warn(
              this.i18n.t('logging.inference.allocationRecommendation.symbol_normalized', {
                args: {
                  from: item.symbol,
                  to: targetSymbol,
                },
              }),
            );
          }

          const { messages, marketFeatures, marketRegime, feargreed } =
            await this.tradeOrchestrationService.buildRecommendationPromptMessages({
              symbol: targetSymbol,
              prompt: UPBIT_ALLOCATION_RECOMMENDATION_PROMPT,
              openaiService: this.openaiService,
              featureService: this.featureService,
              newsService: this.newsService,
              marketRegimeService: this.marketRegimeService,
              errorService: this.errorService,
              allocationAuditService: this.allocationAuditService,
              onNewsError: (error) => this.logger.error(this.i18n.t('logging.news.load_failed'), error),
              onMarketRegimeError: (error) => this.logger.error(this.i18n.t('logging.marketRegime.load_failed'), error),
              onValidationGuardrailError: (error, symbol) => {
                this.logger.warn(
                  this.i18n.t('logging.inference.allocationRecommendation.validation_guardrail_load_failed', {
                    args: { symbol },
                  }),
                  error,
                );
              },
            });

          const requestConfig = {
            ...UPBIT_ALLOCATION_RECOMMENDATION_CONFIG,
            text: {
              format: {
                type: 'json_schema' as const,
                name: 'allocation_recommendation',
                strict: true,
                schema: UPBIT_ALLOCATION_RECOMMENDATION_RESPONSE_SCHEMA as Record<string, unknown>,
              },
            },
          };

          // 실시간 API 호출 (Responses API + web_search)
          const response = await this.openaiService.createResponse(messages, requestConfig);
          const output = this.openaiService.getResponseOutput(response);
          const outputText = output.text;
          if (!outputText || outputText.trim() === '') {
            return null;
          }
          const responseData = JSON.parse(outputText);
          const normalizedResponse = this.tradeOrchestrationService.normalizeRecommendationResponsePayload(
            responseData,
            {
              expectedSymbol: targetSymbol,
              dropOnSymbolMismatch: true,
              onSymbolMismatch: ({ outputSymbol, expectedSymbol }) => {
                this.logger.warn(
                  this.i18n.t('logging.inference.allocationRecommendation.symbol_mismatch_dropped', {
                    args: {
                      outputSymbol,
                      expectedSymbol,
                    },
                  }),
                );
              },
            },
          );
          if (!normalizedResponse) {
            return null;
          }

          const safeIntensity = normalizedResponse.intensity;
          const reason = normalizedResponse.reason;
          const modelSignals = this.calculateModelSignals(safeIntensity, item.category, marketFeatures, targetSymbol);
          const latestMetricsBySymbol =
            latestRecommendationMetricsBySymbol.get(targetSymbol) ??
            latestRecommendationMetricsBySymbol.get(item.symbol);
          const decisionConfidence = normalizedResponse.confidence;
          const tradeCostTelemetry = this.deriveTradeCostTelemetry(
            marketFeatures,
            normalizedResponse.expectedVolatilityPct,
            decisionConfidence,
          );

          let action: AllocationRecommendationAction = modelSignals.action;
          let modelTargetWeight = this.tradeOrchestrationService.clampToUnitInterval(modelSignals.modelTargetWeight);

          if (normalizedResponse.action === 'sell') {
            action = 'sell';
            modelTargetWeight = 0;
          } else if (normalizedResponse.action === 'buy') {
            action = 'buy';
            modelTargetWeight = Math.max(
              modelTargetWeight,
              this.tradeOrchestrationService.clampToUnitInterval(safeIntensity),
            );
          } else if (normalizedResponse.action === 'hold') {
            action = 'hold';
          } else if (normalizedResponse.action === 'no_trade') {
            action = 'no_trade';
            modelTargetWeight = 0;
          }

          if (decisionConfidence < this.tradeOrchestrationService.getMinimumAllocationConfidence()) {
            action = 'no_trade';
            modelTargetWeight = 0;
          }

          // 추론 결과와 아이템 병합
          return {
            ...responseData,
            symbol: targetSymbol,
            intensity: safeIntensity,
            reason: reason.length > 0 ? reason : null,
            category: item?.category,
            hasStock: item?.hasStock || false,
            prevIntensity: latestMetricsBySymbol?.intensity ?? null,
            prevModelTargetWeight: latestMetricsBySymbol?.modelTargetWeight ?? null,
            weight: item?.weight,
            confidence: item?.confidence,
            decisionConfidence,
            expectedVolatilityPct: normalizedResponse.expectedVolatilityPct,
            riskFlags: normalizedResponse.riskFlags,
            btcDominance: marketRegime?.btcDominance ?? null,
            altcoinIndex: marketRegime?.altcoinIndex ?? null,
            marketRegimeAsOf: marketRegime?.asOf ?? null,
            marketRegimeSource: marketRegime?.source ?? null,
            marketRegimeIsStale: marketRegime?.isStale ?? null,
            feargreedIndex: feargreed?.index ?? null,
            feargreedClassification: feargreed?.classification ?? null,
            feargreedTimestamp:
              feargreed?.timestamp != null && Number.isFinite(feargreed.timestamp)
                ? new Date(feargreed.timestamp * 1000)
                : null,
            buyScore: modelSignals.buyScore,
            sellScore: modelSignals.sellScore,
            modelTargetWeight,
            action,
            expectedEdgeRate: tradeCostTelemetry.expectedEdgeRate,
            estimatedCostRate: tradeCostTelemetry.estimatedCostRate,
            spreadRate: tradeCostTelemetry.spreadRate,
            impactRate: tradeCostTelemetry.impactRate,
          };
        });
      }),
    );

    const validResults = inferenceResults.filter((r): r is NonNullable<typeof r> => r != null);

    // 추론 결과가 없으면 빈 배열 반환
    if (validResults.length === 0) {
      this.logger.log(this.i18n.t('logging.inference.allocationRecommendation.complete'));
      return [];
    }

    // 결과 저장
    this.logger.log(
      this.i18n.t('logging.inference.allocationRecommendation.presave', { args: { count: validResults.length } }),
    );

    const batchId = generateMonotonicUlid();
    const recommendationResults = await Promise.all(
      validResults.map((recommendation) => this.saveAllocationRecommendation({ ...recommendation, batchId })),
    );

    this.logger.log(
      this.i18n.t('logging.inference.allocationRecommendation.save', { args: { count: recommendationResults.length } }),
    );

    this.logger.log(this.i18n.t('logging.inference.allocationRecommendation.complete'));
    this.allocationAuditService
      .enqueueAllocationBatchValidation(batchId)
      .catch((error) =>
        this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.enqueue_validation_failed'), error),
      );

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
      reason: saved.reason != null ? toUserFacingText(saved.reason) : null,
      hasStock: validResults[index].hasStock,
      weight: validResults[index].weight,
      confidence: validResults[index].confidence,
      decisionConfidence: validResults[index].decisionConfidence,
      expectedVolatilityPct: validResults[index].expectedVolatilityPct,
      riskFlags: validResults[index].riskFlags,
      expectedEdgeRate: validResults[index].expectedEdgeRate,
      estimatedCostRate: validResults[index].estimatedCostRate,
      spreadRate: validResults[index].spreadRate,
      impactRate: validResults[index].impactRate,
      btcDominance: saved.btcDominance,
      altcoinIndex: saved.altcoinIndex,
      marketRegimeAsOf: saved.marketRegimeAsOf,
      marketRegimeSource: saved.marketRegimeSource,
      marketRegimeIsStale: saved.marketRegimeIsStale,
      feargreedIndex: saved.feargreedIndex,
      feargreedClassification: saved.feargreedClassification,
      feargreedTimestamp: saved.feargreedTimestamp,
    }));
  }

  /**
   * 잔고 추천 결과 저장
   *
   * @param recommendation 잔고 추천 데이터
   * @returns 저장된 잔고 추천 엔티티
   */
  public async saveAllocationRecommendation(
    recommendation: AllocationRecommendationData,
  ): Promise<AllocationRecommendation> {
    const normalizedSymbol =
      recommendation.category === Category.NASDAQ
        ? recommendation.symbol?.trim().toUpperCase()
        : normalizeKrwSymbol(recommendation.symbol);
    if (!normalizedSymbol) {
      throw new Error(`Invalid balance recommendation symbol: ${recommendation.symbol}`);
    }

    const allocationRecommendation = new AllocationRecommendation();
    Object.assign(allocationRecommendation, recommendation, { symbol: normalizedSymbol });
    allocationRecommendation.btcDominance = recommendation.btcDominance ?? null;
    allocationRecommendation.altcoinIndex = recommendation.altcoinIndex ?? null;
    allocationRecommendation.marketRegimeAsOf = recommendation.marketRegimeAsOf ?? null;
    allocationRecommendation.marketRegimeSource = recommendation.marketRegimeSource ?? null;
    allocationRecommendation.marketRegimeIsStale = recommendation.marketRegimeIsStale ?? null;
    allocationRecommendation.feargreedIndex = recommendation.feargreedIndex ?? null;
    allocationRecommendation.feargreedClassification = recommendation.feargreedClassification ?? null;
    allocationRecommendation.feargreedTimestamp = recommendation.feargreedTimestamp ?? null;
    return allocationRecommendation.save();
  }
}
