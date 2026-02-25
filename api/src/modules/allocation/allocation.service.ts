import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { Message, SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Balances } from 'ccxt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import {
  buildCurrentWeightMap,
  buildOrderableSymbolSet,
  buildTradableMarketValueMap,
} from '@/modules/allocation-core/helpers/allocation-holdings';
import { resolveMarketRegimeMultiplier } from '@/modules/allocation-core/helpers/allocation-market-regime';
import {
  calculateAllocationBand,
  calculateAllocationModelSignals,
  calculateRegimeAdjustedTargetWeight,
  calculateRelativeDiff,
  clamp01,
  filterExcludedRecommendationsByCategory,
  filterIncludedRecommendationsByCategory,
  isNoTradeRecommendation,
  isOrderableSymbol,
  isSellAmountSufficient,
  normalizeAllocationRecommendationResponsePayload,
  passesCostGate,
  resolveAvailableKrwBalance,
  scaleBuyRequestsToAvailableKrw,
  shouldReallocate,
  toPercentString,
} from '@/modules/allocation-core/helpers/allocation-recommendation';
import { buildAllocationRecommendationPromptMessages } from '@/modules/allocation-core/helpers/allocation-recommendation-context';
import { buildLatestAllocationRecommendationMetricsMap } from '@/modules/allocation-core/helpers/allocation-recommendation-metrics';
import {
  applyHeldAssetFlags,
  filterAuthorizedRecommendationItems,
  filterUniqueNonBlacklistedItems,
  getMaxAuthorizedItemCount,
} from '@/modules/allocation-core/helpers/recommendation-item';
import { CacheService } from '@/modules/cache/cache.service';
import { ErrorService } from '@/modules/error/error.service';
import { FeatureService } from '@/modules/feature/feature.service';
import {
  buildMergedHoldingsForSave,
  collectExecutedBuyHoldingItems,
  collectLiquidatedHoldingItems,
} from '@/modules/holding-ledger/helpers/holding-ledger-trade';
import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';
import { NewsService } from '@/modules/news/news.service';
import { toUserFacingText } from '@/modules/openai/openai-citation.util';
import { OpenaiService } from '@/modules/openai/openai.service';
import { startSqsConsumer } from '@/modules/trade-execution-ledger/helpers/sqs-consumer';
import { readStringValue, stringifyUnknownError } from '@/modules/trade-execution-ledger/helpers/sqs-message';
import { isNonRetryableExecutionError } from '@/modules/trade-execution-ledger/helpers/sqs-processing';
import { markMalformedMessageAsNonRetryable } from '@/modules/trade-execution-ledger/helpers/trade-execution-malformed';
import { parseQueuedInference } from '@/modules/trade-execution-ledger/helpers/trade-execution-message';
import { parseTradeExecutionMessage } from '@/modules/trade-execution-ledger/helpers/trade-execution-parser';
import { processTradeExecutionMessage } from '@/modules/trade-execution-ledger/helpers/trade-execution-pipeline';
import { executeTradesSequentiallyWithRequests } from '@/modules/trade-execution-ledger/helpers/trade-execution-runner';
import { generateMonotonicUlid } from '@/utils/id';
import { formatNumber } from '@/utils/number';
import { normalizeKrwSymbol } from '@/utils/symbol';

import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { HoldingLedgerService } from '../holding-ledger/holding-ledger.service';
import { MarketSignal } from '../market-intelligence/entities/market-signal.entity';
import {
  MARKET_SIGNAL_STATE_CACHE_KEY,
  MARKET_SIGNAL_STATE_MAX_AGE_MS,
  MarketSignalState,
} from '../market-intelligence/market-intelligence.interface';
import { MarketRegimeService } from '../market-regime/market-regime.service';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TradeExecutionModule } from '../trade-execution-ledger/trade-execution-ledger.enum';
import { TradeExecutionLedgerService } from '../trade-execution-ledger/trade-execution-ledger.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeData, TradeRequest } from '../trade/trade.interface';
import { UPBIT_MINIMUM_TRADE_PRICE } from '../upbit/upbit.constant';
import { OrderTypes } from '../upbit/upbit.enum';
import { MarketFeatures } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  ALLOCATION_RECOMMENDATION_EXISTING_LOCK,
  ALLOCATION_RECOMMENDATION_NEW_LOCK,
  ScheduleExpression,
} from './allocation.enum';
import {
  AllocationMode,
  AllocationRecommendationAction,
  AllocationRecommendationData,
  QueueTradeExecutionMessageV2,
  RecommendationItem,
  TradeExecutionMessageV2,
} from './allocation.interface';
import { AllocationRecommendationDto } from './dto/allocation-recommendation.dto';
import { GetAllocationRecommendationsCursorDto } from './dto/get-allocation-recommendations-cursor.dto';
import { GetAllocationRecommendationsPaginationDto } from './dto/get-allocation-recommendations-pagination.dto';
import { AllocationRecommendation } from './entities/allocation-recommendation.entity';
import {
  UPBIT_ALLOCATION_RECOMMENDATION_CONFIG,
  UPBIT_ALLOCATION_RECOMMENDATION_PROMPT,
  UPBIT_ALLOCATION_RECOMMENDATION_RESPONSE_SCHEMA,
} from './prompts/allocation-recommendation.prompt';

/**
 * 리밸런싱 모듈의 핵심 서비스.
 *
 * - 기존 보유 종목 및 새로운 추천 종목을 대상으로 잔고 추천을 수행한다.
 * - 스케줄 활성화된 사용자들에 대해 실제 거래를 실행한다.
 * - SQS를 통해 비동기로 거래를 처리한다.
 */
@Injectable()
export class AllocationService implements OnModuleInit {
  private readonly logger = new Logger(AllocationService.name);

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
  private readonly MIN_ALLOCATION_BAND = 0.01;
  private readonly ALLOCATION_BAND_RATIO = 0.1;
  private readonly ESTIMATED_FEE_RATE = 0.0005;
  private readonly ESTIMATED_SLIPPAGE_RATE = 0.001;
  private readonly COST_GUARD_MULTIPLIER = 2;
  private readonly MIN_RECOMMEND_WEIGHT = 0.05;
  private readonly MIN_RECOMMEND_CONFIDENCE = 0.45;
  private readonly MIN_ALLOCATION_CONFIDENCE = 0.35;
  private readonly QUEUE_MESSAGE_VERSION = 2 as const;
  private readonly MESSAGE_TTL_MS = 30 * 60 * 1000;
  private readonly USER_TRADE_LOCK_DURATION_MS = 5 * 60 * 1000;
  private readonly PROCESSING_HEARTBEAT_INTERVAL_MS = 60 * 1000;
  private readonly COIN_MAJOR_ITEM_COUNT = 2;
  private readonly COIN_MINOR_ITEM_COUNT = 5;
  private readonly NASDAQ_ITEM_COUNT = 0;
  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;
  private readonly DEFAULT_ALLOCATION_MODE: AllocationMode = 'new';

  // Amazon SQS
  private readonly sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  private readonly queueUrl = process.env.AWS_SQS_QUEUE_URL_ALLOCATION;
  private readonly acceptedLegacyQueueModules = ['rebalance'];
  private readonly outboundQueueModuleLabel = 'allocation' as const;

  constructor(
    private readonly i18n: I18nService,
    private readonly blacklistService: BlacklistService,
    private readonly holdingLedgerService: HoldingLedgerService,
    private readonly upbitService: UpbitService,
    private readonly cacheService: CacheService,
    private readonly scheduleService: ScheduleService,
    private readonly categoryService: CategoryService,
    private readonly notifyService: NotifyService,
    private readonly profitService: ProfitService,
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
      throw new Error('AWS_SQS_QUEUE_URL_ALLOCATION environment variable is required');
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
   * - 리밸런싱 전용 큐의 메시지를 처리합니다.
   * - 사용자별 리밸런싱 거래를 실행하고 수익금 알림을 전송합니다.
   * - 처리 완료 후 메시지를 큐에서 삭제합니다.
   *
   * @param message SQS 메시지
   */
  private async handleMessage(message: Message): Promise<void> {
    const messageId = message.MessageId;
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));
    await processTradeExecutionMessage<TradeExecutionMessageV2>({
      module: TradeExecutionModule.ALLOCATION,
      message,
      sqs: this.sqs,
      queueUrl: this.queueUrl,
      heartbeatIntervalMs: this.PROCESSING_HEARTBEAT_INTERVAL_MS,
      parseMessage: (messageBody) => this.parseAllocationMessage(messageBody),
      onMalformedMessage: async (targetMessage, error) => {
        await markMalformedMessageAsNonRetryable(
          {
            message: targetMessage,
            module: TradeExecutionModule.ALLOCATION,
            messageTtlMs: this.MESSAGE_TTL_MS,
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
              module: TradeExecutionModule.ALLOCATION,
              error: stringifyUnknownError(error),
            },
          }),
        );
      },
      ledgerService: this.tradeExecutionLedgerService,
      withUserLock: (userId, callback) =>
        this.redlockService.withLock(`trade:user:${userId}`, this.USER_TRADE_LOCK_DURATION_MS, callback),
      executeLocked: async (parsedMessage, assertLockOrThrow) => {
        assertLockOrThrow();
        const user = await this.userService.findById(parsedMessage.userId);
        assertLockOrThrow();
        const trades = await this.executeAllocationForUser(
          user,
          parsedMessage.inferences,
          parsedMessage.allocationMode ?? this.DEFAULT_ALLOCATION_MODE,
          assertLockOrThrow,
        );
        assertLockOrThrow();

        this.logger.debug(
          this.i18n.t('logging.sqs.message.executed_trades_debug', {
            args: {
              module: TradeExecutionModule.ALLOCATION,
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
              module: TradeExecutionModule.ALLOCATION,
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
   * Parses allocation message for the allocation recommendation flow.
   * @param messageBody - Message payload handled by the allocation recommendation flow.
   * @returns Result produced by the allocation recommendation flow.
   */
  private parseAllocationMessage(messageBody: string | undefined): TradeExecutionMessageV2 {
    return parseTradeExecutionMessage({
      module: TradeExecutionModule.ALLOCATION,
      moduleLabel: 'allocation',
      queueMessageVersion: this.QUEUE_MESSAGE_VERSION,
      messageBody,
      acceptedModuleAliases: this.acceptedLegacyQueueModules,
      parseInference: parseQueuedInference,
      parseAllocationMode: (value) => this.parseAllocationMode(value),
    });
  }

  /**
   * Parses allocation mode for the allocation recommendation flow.
   * @param value - Input value for value.
   * @returns Result produced by the allocation recommendation flow.
   */
  private parseAllocationMode(value: unknown): AllocationMode {
    if (value == null) {
      return this.DEFAULT_ALLOCATION_MODE;
    }

    if (value === 'new' || value === 'existing') {
      return value;
    }

    throw new Error('Invalid allocationMode');
  }

  /**
   * 새로운 종목 포함 리밸런싱 스케줄
   *
   * - 매일 오전 6시 35분에 실행됩니다.
   * - 기존 보유 종목 + 메이저 코인 + 시장 시그널 종목을 대상으로 리밸런싱을 수행합니다.
   * - 전체 자산 배분를 재조정하여 새로운 투자 기회를 포착합니다.
   */
  @Cron(ScheduleExpression.DAILY_ALLOCATION_RECOMMENDATION_NEW)
  @WithRedlock(ALLOCATION_RECOMMENDATION_NEW_LOCK) // 1시간 동안 실행
  public async executeAllocationRecommendationNew(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.executeAllocationRecommendationNewTask();
  }

  /**
   * Runs allocation recommendation new task in the allocation recommendation workflow.
   */
  public async executeAllocationRecommendationNewTask(): Promise<void> {
    this.logger.log(this.i18n.t('logging.schedule.start'));

    // 스케줄 활성화된 사용자 목록 조회
    const users = await this.scheduleService.getUsers();
    if (users.length < 1) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      this.logger.log(this.i18n.t('logging.schedule.end'));
      return;
    }

    // 공통 후보군: 메이저 코인(BTC/ETH) 및 시장 시그널 종목
    const majorCoinItems = await this.fetchMajorCoinItems();
    const recommendItems = await this.fetchRecommendItems();
    const recommendMetadataBySymbol = new Map(
      recommendItems.map((item) => [item.symbol, { weight: item.weight, confidence: item.confidence }]),
    );

    const userHoldingPairs = await this.fetchUserHoldingPairsSafely(users);
    const usersWithHoldingFetchSuccess = userHoldingPairs.map((pair) => pair.user);
    if (usersWithHoldingFetchSuccess.length < 1) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      this.logger.log(this.i18n.t('logging.schedule.end'));
      return;
    }
    const mergedHoldingItems = userHoldingPairs.flatMap((pair) =>
      pair.items.map((item) => {
        const recommendMetadata = recommendMetadataBySymbol.get(item.symbol);
        return {
          ...item,
          // 공통 추론 입력에서는 사용자별 보유 여부가 섞이지 않도록 중립값으로 정규화한다.
          // 실제 사용자별 보유 컨텍스트는 executeAllocationForUser 단계에서 사용자 보유 원장를 다시 조회해 적용한다.
          hasStock: false,
          // holding/recommend 심볼이 겹치면 recommend의 weight/confidence를 유지한다.
          weight: recommendMetadata?.weight ?? item.weight,
          confidence: recommendMetadata?.confidence ?? item.confidence,
        };
      }),
    );
    // 우선 순위를 반영해 추론 종목 목록 정리
    // 순서: 기존 보유 > 메이저 코인 > 시장 시그널 (앞에 있는 것이 우선순위 높음)
    const allItems = [...mergedHoldingItems, ...majorCoinItems, ...recommendItems];
    // 중복 제거 및 블랙리스트 필터링
    const items = await this.filterAllocationRecommendations(allItems);

    // new 모드는 사용자별 보유 후보를 유지하되, 공통 후보(메이저/추천)는 모든 사용자에 공유한다.
    const commonSymbols = new Set([...majorCoinItems, ...recommendItems].map((item) => item.symbol));
    const inferenceSymbolsByUserId = new Map<string, Set<string>>(
      userHoldingPairs.map(({ user, items: holdingItems }) => [
        user.id,
        new Set([...commonSymbols, ...holdingItems.map((item) => item.symbol)]),
      ]),
    );

    // 단 1회 추론 후 결과를 사용자별 주문 실행에 재사용
    await this.scheduleAllocation(usersWithHoldingFetchSuccess, items, 'new', inferenceSymbolsByUserId);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  /**
   * 기존 보유 종목만 리밸런싱 스케줄
   *
   * - 매일 0, 4, 8, 12, 16, 20시 35분에 실행됩니다 (4시간 간격).
   * - 기존 보유 종목만 대상으로 리밸런싱을 수행합니다.
   * - 자산 배분 비율을 재조정하여 최적의 배분을 유지합니다.
   */
  @Cron(ScheduleExpression.DAILY_ALLOCATION_RECOMMENDATION_EXISTING)
  @WithRedlock(ALLOCATION_RECOMMENDATION_EXISTING_LOCK) // 1시간 동안 실행
  public async executeAllocationRecommendationExisting(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.executeAllocationRecommendationExistingTask();
  }

  /**
   * Runs allocation recommendation existing task in the allocation recommendation workflow.
   */
  public async executeAllocationRecommendationExistingTask(): Promise<void> {
    this.logger.log(this.i18n.t('logging.schedule.start'));

    // 스케줄 활성화된 사용자 목록 조회
    const users = await this.scheduleService.getUsers();
    if (users.length < 1) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      this.logger.log(this.i18n.t('logging.schedule.end'));
      return;
    }

    const userHoldingPairs = await this.fetchUserHoldingPairsSafely(users);
    const usersWithHoldingPairs = userHoldingPairs.filter((pair) => pair.items.length > 0);
    const usersWithHoldings = usersWithHoldingPairs.map((pair) => pair.user);
    if (usersWithHoldings.length < 1) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      this.logger.log(this.i18n.t('logging.schedule.end'));
      return;
    }

    // 기존 보유 항목만 재추론: 개인 보유 원장이 있는 사용자들의 항목만 합산해 중복 제거 후 1회 추론
    const mergedHoldingItems = usersWithHoldingPairs.flatMap((pair) => pair.items);
    const items = await this.filterAllocationRecommendations(mergedHoldingItems);
    const inferenceSymbolsByUserId = new Map<string, Set<string>>(
      usersWithHoldingPairs.map(({ user, items: holdingItems }) => [
        user.id,
        new Set(holdingItems.map((item) => item.symbol)),
      ]),
    );

    // 단 1회 추론 후 결과를 사용자별 주문 실행에 재사용
    await this.scheduleAllocation(usersWithHoldings, items, 'existing', inferenceSymbolsByUserId);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  /**
   * Retrieves user holding pairs safely for the allocation recommendation flow.
   * @param users - User identifier related to this operation.
   * @returns Processed collection for downstream workflow steps.
   */
  private async fetchUserHoldingPairsSafely(
    users: User[],
  ): Promise<Array<{ user: User; items: RecommendationItem[] }>> {
    const settledResults = await Promise.allSettled(
      users.map(async (user) => ({
        user,
        items: await this.holdingLedgerService.fetchHoldingsByUser(user),
      })),
    );
    const pairs: Array<{ user: User; items: RecommendationItem[] }> = [];

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        pairs.push(result.value);
        return;
      }

      const user = users[index];
      this.logger.warn(
        this.i18n.t('logging.schedule.allocationRecommendation.holdings_load_failed', {
          args: {
            id: user?.id ?? 'unknown',
            error: stringifyUnknownError(result.reason),
          },
        }),
        result.reason,
      );
    });

    return pairs;
  }

  /**
   * 리밸런싱 스케줄 실행: 추론 실행 + SQS 메시지 전송
   *
   * - 주기적으로 실행되는 리밸런싱 작업의 전체 프로세스를 처리합니다.
   * - 추론 실행 → SQS 메시지 전송 순서로 진행됩니다.
   * - SQS를 통해 비동기로 사용자별 거래를 처리하여 동시성 문제를 방지합니다.
   *
   * @param users 스케줄 활성화된 사용자 목록
   * @param items 추론 대상 종목 목록 (기존 보유 종목 + 새로운 추천 종목)
   */
  public async scheduleAllocation(
    users: User[],
    items: RecommendationItem[],
    allocationMode: AllocationMode,
    inferenceSymbolsByUserId?: Map<string, Set<string>>,
  ): Promise<void> {
    if (users.length < 1 || items.length < 1) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      return;
    }

    // 1. 추론 실행: 종목별 잔고 추천 비율 계산
    const inferences = await this.allocationRecommendation(items);

    // 2. SQS 메시지 전송: 각 사용자별로 리밸런싱 작업을 큐에 등록
    await this.publishAllocationMessage(users, inferences, allocationMode, inferenceSymbolsByUserId);

    // 3. 클라이언트 초기화: Upbit 및 Notify 클라이언트 캐시 초기화
    this.upbitService.clearClients();
    this.notifyService.clearClients();
  }

  /**
   * 리밸런싱 SQS 메시지 전송
   *
   * - 리밸런싱 전용 SQS 큐에 사용자별 거래 작업 메시지를 전송합니다.
   * - 각 사용자마다 별도의 메시지를 생성하여 병렬로 전송합니다.
   * - 메시지는 비동기로 처리되어 동시성 문제를 방지합니다.
   *
   * @param users 스케줄 활성화된 사용자 목록
   * @param inferences 추론 결과 (종목별 잔고 추천 비율)
   */
  private async publishAllocationMessage(
    users: User[],
    inferences: AllocationRecommendationData[],
    allocationMode: AllocationMode,
    inferenceSymbolsByUserId?: Map<string, Set<string>>,
  ): Promise<void> {
    try {
      const runId = randomUUID();
      const generatedAt = new Date();
      const expiresAt = new Date(generatedAt.getTime() + this.MESSAGE_TTL_MS);
      const targets = users
        .map((user) => ({
          user,
          inferences: this.scopeInferencesForUser(user, inferences, inferenceSymbolsByUserId),
        }))
        .filter((target) => target.inferences.length > 0);
      this.logger.log(
        this.i18n.t('logging.sqs.producer.start', {
          args: { count: targets.length },
        }),
      );

      if (targets.length < 1) {
        this.logger.log(this.i18n.t('logging.sqs.producer.complete'));
        return;
      }

      // 각 사용자별로 리밸런싱 메시지 생성
      // 메시지 본문에 사용자 정보, 추론 결과 포함
      const messages = targets.map(
        ({ user, inferences: scopedInferences }) =>
          new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify({
              version: this.QUEUE_MESSAGE_VERSION,
              module: this.outboundQueueModuleLabel,
              runId,
              messageKey: `${runId}:${user.id}`,
              userId: user.id,
              generatedAt: generatedAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
              allocationMode,
              inferences: scopedInferences,
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
   * Handles scope inferences for user in the allocation recommendation workflow.
   * @param user - User identifier related to this operation.
   * @param inferences - Input value for inferences.
   * @param inferenceSymbolsByUserId - Asset symbol to process.
   * @returns Processed collection for downstream workflow steps.
   */
  private scopeInferencesForUser(
    user: User,
    inferences: AllocationRecommendationData[],
    inferenceSymbolsByUserId?: Map<string, Set<string>>,
  ): AllocationRecommendationData[] {
    if (!inferenceSymbolsByUserId) {
      return inferences;
    }

    const allowedSymbols = inferenceSymbolsByUserId.get(user.id);
    if (!allowedSymbols || allowedSymbols.size < 1) {
      return [];
    }

    return inferences.filter((inference) => allowedSymbols.has(inference.symbol));
  }

  /**
   * 사용자별 리밸런싱 거래 실행
   *
   * - SQS consumer에서 호출되는 메인 거래 실행 함수입니다.
   * - 전체 자산 배분를 재조정합니다:
   *   1. 권한이 없는 종목 필터링
   *   2. 편입/편출 종목 결정
   *   3. 편출 처리 (기존 보유 종목 중 추론에 없는 종목 매도)
   *   4. 편입 처리 (추론된 종목 매수)
   * - 거래 완료 후 사용자에게 알림을 전송합니다.
   *
   * @param user 거래를 실행할 사용자
   * @param inferences 추론 결과 (종목별 잔고 추천 비율)
   * @returns 실행된 거래 목록
   */
  public async executeAllocationForUser(
    user: User,
    inferences: AllocationRecommendationData[],
    allocationMode: AllocationMode = this.DEFAULT_ALLOCATION_MODE,
    lockGuard?: (() => void) | null,
  ): Promise<Trade[]> {
    const assertLockOrThrow = typeof lockGuard === 'function' ? lockGuard : () => undefined;
    assertLockOrThrow();

    const holdingItems = await this.holdingLedgerService.fetchHoldingsByUser(user);
    const holdingScopedRecommendations = applyHeldAssetFlags(inferences, holdingItems);
    assertLockOrThrow();

    // 권한이 있는 추천만 필터링: 사용자가 거래할 수 있는 카테고리만 포함
    const enabledCategories = await this.categoryService.findEnabledByUser(user);
    const authorizedRecommendations = filterAuthorizedRecommendationItems(
      user,
      holdingScopedRecommendations,
      enabledCategories,
      (targetUser, category) => this.categoryService.checkCategoryPermission(targetUser, category),
    );
    assertLockOrThrow();

    // 권한이 있는 추천이 없으면 리포트/알림 없이 종료
    if (authorizedRecommendations.length === 0) {
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      return [];
    }

    // 추론 결과를 사용자에게 알림 전송 (종목별 추천 비율 표시)
    await this.notifyService.notify(
      user,
      this.i18n.t('notify.allocationRecommendation.result', {
        args: {
          transactions: authorizedRecommendations
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

    // 사용자별 최대 편입 종목 수 계산 (카테고리별 제한 고려)
    const userCategories = await this.categoryService.findEnabledByUser(user);
    const count = getMaxAuthorizedItemCount(
      user,
      userCategories.map((userCategory) => userCategory.category),
      (targetUser, category) => this.categoryService.checkCategoryPermission(targetUser, category),
      {
        coinMajorItemCount: this.COIN_MAJOR_ITEM_COUNT,
        coinMinorItemCount: this.COIN_MINOR_ITEM_COUNT,
        nasdaqItemCount: this.NASDAQ_ITEM_COUNT,
      },
    );
    assertLockOrThrow();
    const allowBackfill = allocationMode === 'new';
    const slotCount = count;

    // 유저 계좌 조회: 현재 보유 종목 및 잔고 정보
    const balances = await this.upbitService.getBalances(user);
    assertLockOrThrow();

    // 계좌 정보가 없으면 거래 불가
    if (!balances) {
      // 계좌 스냅샷이 없으면 자산 배분 히스토리를 갱신하지 않는다.
      this.upbitService.clearClients();
      this.notifyService.clearClients();
      return [];
    }

    const orderableSymbols = await buildOrderableSymbolSet(
      [
        ...authorizedRecommendations.map((recommendation) => recommendation.symbol),
        ...balances.info.map((item) => `${item.currency}/${item.unit_currency}`),
      ],
      {
        isSymbolExist: (symbol) => this.upbitService.isSymbolExist(symbol),
        onAllCheckFailed: () =>
          this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_failed')),
        onPartialCheck: () =>
          this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_partial')),
      },
    );
    assertLockOrThrow();
    // 거래 가능한 총 평가금액은 사용자당 1회만 계산해 모든 주문에서 재사용
    const marketPrice = await this.upbitService.calculateTradableMarketValue(balances, orderableSymbols);
    assertLockOrThrow();
    // 시장 상황에 따른 전체 익스포저 배율 (risk-on/risk-off)
    const regimeMultiplier = await resolveMarketRegimeMultiplier(() =>
      this.errorService.retryWithFallback(() => this.marketRegimeService.getSnapshot()),
    );
    assertLockOrThrow();
    // 현재가 기준 자산 배분 비중 맵 (심볼 -> 현재 비중)
    const currentWeights = await buildCurrentWeightMap(
      balances,
      marketPrice,
      (symbol) => this.upbitService.getPrice(symbol),
      orderableSymbols,
    );
    assertLockOrThrow();
    const tradableMarketValueMap = await buildTradableMarketValueMap(
      balances,
      (symbol) => this.upbitService.getPrice(symbol),
      orderableSymbols,
    );
    assertLockOrThrow();

    // 편입/편출 결정 분리
    // 1. 추론에 없는 기존 보유 종목 매도 요청 (완전 매도)
    const nonAllocationRecommendationTradeRequests: TradeRequest[] =
      this.generateNonAllocationRecommendationTradeRequests(
        balances,
        authorizedRecommendations,
        marketPrice,
        orderableSymbols,
        tradableMarketValueMap,
      );

    // 2. 편출 대상 종목 매도 요청 (추론에서 제외된 종목)
    const excludedTradeRequests: TradeRequest[] = this.generateExcludedTradeRequests(
      balances,
      authorizedRecommendations,
      slotCount,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      allowBackfill,
    );

    // 3. 편입 대상 종목 매수/매도 요청 (목표 비율 조정)
    const includedTradeRequests: TradeRequest[] = this.generateIncludedTradeRequests(
      balances,
      authorizedRecommendations,
      slotCount,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      allowBackfill,
    );
    const noTradeTrimRequests: TradeRequest[] = this.generateNoTradeTrimRequests(
      balances,
      authorizedRecommendations,
      slotCount,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      allowBackfill,
    );
    const includedSellRequests = includedTradeRequests.filter((item) => item.diff < 0);
    const sellRequests = [
      ...nonAllocationRecommendationTradeRequests,
      ...excludedTradeRequests,
      ...includedSellRequests,
      ...noTradeTrimRequests,
    ];

    // 주문 정책: 매도 순차 실행
    const sellExecutions = await executeTradesSequentiallyWithRequests(
      sellRequests,
      (request) => this.executeTrade(user, request),
      assertLockOrThrow,
    );
    assertLockOrThrow();
    const sellTrades = sellExecutions.map((execution) => execution.trade).filter((item): item is Trade => !!item);

    // 주문 정책: 매도 완료 후 잔고 재조회
    const refreshedBalances = await this.upbitService.getBalances(user);
    assertLockOrThrow();

    let buyExecutions: Array<{ request: TradeRequest; trade: Trade | null }> = [];
    if (refreshedBalances) {
      const refreshedOrderableSymbols = await buildOrderableSymbolSet(
        [
          ...authorizedRecommendations.map((recommendation) => recommendation.symbol),
          ...refreshedBalances.info.map((item) => `${item.currency}/${item.unit_currency}`),
        ],
        {
          isSymbolExist: (symbol) => this.upbitService.isSymbolExist(symbol),
          onAllCheckFailed: () =>
            this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_failed')),
          onPartialCheck: () =>
            this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_partial')),
        },
      );
      assertLockOrThrow();
      const refreshedMarketPrice = await this.upbitService.calculateTradableMarketValue(
        refreshedBalances,
        refreshedOrderableSymbols,
      );
      assertLockOrThrow();
      const refreshedCurrentWeights = await buildCurrentWeightMap(
        refreshedBalances,
        refreshedMarketPrice,
        (symbol) => this.upbitService.getPrice(symbol),
        refreshedOrderableSymbols,
      );
      assertLockOrThrow();
      const refreshedTradableMarketValueMap = await buildTradableMarketValueMap(
        refreshedBalances,
        (symbol) => this.upbitService.getPrice(symbol),
        refreshedOrderableSymbols,
      );
      assertLockOrThrow();

      const refreshedIncludedTradeRequests = this.generateIncludedTradeRequests(
        refreshedBalances,
        authorizedRecommendations,
        slotCount,
        regimeMultiplier,
        refreshedCurrentWeights,
        refreshedMarketPrice,
        refreshedOrderableSymbols,
        refreshedTradableMarketValueMap,
        allowBackfill,
      );
      const buyRequests = refreshedIncludedTradeRequests.filter((item) => item.diff > 0);
      const availableKrw = resolveAvailableKrwBalance(refreshedBalances);
      const scaledBuyRequests = scaleBuyRequestsToAvailableKrw(buyRequests, availableKrw, {
        tradableMarketValueMap: refreshedTradableMarketValueMap,
        fallbackMarketPrice: refreshedMarketPrice,
        minimumTradePrice: UPBIT_MINIMUM_TRADE_PRICE,
        onBudgetInsufficient: ({ availableKrw: targetAvailableKrw, totalEstimated, requestedCount }) => {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.buy_budget_insufficient', {
              args: {
                availableKrw: targetAvailableKrw,
                totalEstimated,
                requestedCount,
              },
            }),
          );
        },
        onBudgetScaled: ({ availableKrw: targetAvailableKrw, totalEstimated, scale, requestedCount }) => {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.buy_budget_scaled', {
              args: {
                availableKrw: targetAvailableKrw,
                totalEstimated,
                scale,
                requestedCount,
              },
            }),
          );
        },
      });

      // 주문 정책: 매수 순차 실행
      buyExecutions = await executeTradesSequentiallyWithRequests(
        scaledBuyRequests,
        (request) => this.executeTrade(user, request),
        assertLockOrThrow,
      );
      assertLockOrThrow();
    }

    const buyTrades = buyExecutions.map((execution) => execution.trade).filter((item): item is Trade => !!item);
    const existingHoldings = await this.holdingLedgerService.fetchHoldingsByUser(user);
    assertLockOrThrow();
    const liquidatedItems = collectLiquidatedHoldingItems(sellExecutions, OrderTypes.SELL, existingHoldings);
    const executedBuyItems = collectExecutedBuyHoldingItems(buyExecutions, OrderTypes.BUY);
    await this.holdingLedgerService.replaceHoldingsForUser(
      user,
      buildMergedHoldingsForSave(existingHoldings, liquidatedItems, executedBuyItems),
    );
    assertLockOrThrow();

    // 실행된 거래 중 null 제거 (주문이 생성되지 않은 경우)
    const allTrades: Trade[] = [...sellTrades, ...buyTrades];

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
      assertLockOrThrow();
    }

    // 클라이언트 캐시 초기화 (메모리 누수 방지)
    this.upbitService.clearClients();
    this.notifyService.clearClients();

    return allTrades;
  }

  /**
   * 추론에 없는 기존 보유 종목 매도 요청 생성
   *
   * - 사용자가 보유 중이지만 추론 결과에 포함되지 않은 종목을 매도 대상으로 합니다.
   * - diff를 -1로 설정하여 즉시 매도하도록 합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @returns 매도 요청 목록
   */
  private generateNonAllocationRecommendationTradeRequests(
    balances: Balances,
    inferences: AllocationRecommendationData[],
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    // 추론에 없는 기존 보유 종목 매도 요청 생성
    const tradeRequests: TradeRequest[] = balances.info
      .filter((item) => {
        const tradableBalance = parseFloat(item.balance || 0);
        const symbol = `${item.currency}/${item.unit_currency}`;
        // 필터링 조건:
        // 1. KRW가 아닌 종목 (currency !== unit_currency)
        // 2. 거래 가능 잔고가 존재
        // 3. 추론 결과에 포함되지 않은 종목
        // 4. KRW/거래가능 심볼
        // 5. 최소 주문 금액 이상
        return (
          item.currency !== item.unit_currency &&
          tradableBalance > 0 &&
          !inferences.some((inference) => inference.symbol === symbol) &&
          isOrderableSymbol(symbol, orderableSymbols) &&
          isSellAmountSufficient(symbol, -1, UPBIT_MINIMUM_TRADE_PRICE, tradableMarketValueMap)
        );
      })
      .map((item) => ({
        symbol: `${item.currency}/${item.unit_currency}`,
        diff: -1, // -1은 완전 매도를 의미
        balances,
        marketPrice,
      }));

    return tradeRequests;
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
   * @param count 편입할 최대 종목 수
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
    allowBackfill: boolean = true,
  ): TradeRequest[] {
    const categoryItemCountConfig = {
      coinMajorItemCount: this.COIN_MAJOR_ITEM_COUNT,
      coinMinorItemCount: this.COIN_MINOR_ITEM_COUNT,
      nasdaqItemCount: this.NASDAQ_ITEM_COUNT,
    };
    // 편입 대상 종목 선정 (최대 count개)
    const filteredAllocationRecommendations = filterIncludedRecommendationsByCategory(inferences, {
      minimumTradeIntensity: this.MINIMUM_TRADE_INTENSITY,
      minAllocationConfidence: this.MIN_ALLOCATION_CONFIDENCE,
      categoryItemCountConfig,
    })
      .filter((inference) => allowBackfill || inference.hasStock)
      .slice(0, count);
    const topK = Math.max(1, count);

    // 편입 거래 요청 생성
    const tradeRequests: TradeRequest[] = filteredAllocationRecommendations
      .map((inference) => {
        if (!isOrderableSymbol(inference.symbol, orderableSymbols)) {
          return null;
        }

        const baseTargetWeight = this.calculateTargetWeight(inference, regimeMultiplier);
        const targetWeight = clamp01(baseTargetWeight / topK);
        const currentWeight = currentWeights.get(inference.symbol) ?? 0;
        const deltaWeight = targetWeight - currentWeight;

        // 목표와 현재 비중 차이가 작으면 불필요한 재조정을 생략
        if (!shouldReallocate(targetWeight, deltaWeight, this.MIN_ALLOCATION_BAND, this.ALLOCATION_BAND_RATIO)) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.skip_allocation_band', {
              args: {
                symbol: inference.symbol,
                targetWeight,
                currentWeight,
                deltaWeight,
                requiredBand: calculateAllocationBand(
                  targetWeight,
                  this.MIN_ALLOCATION_BAND,
                  this.ALLOCATION_BAND_RATIO,
                ),
              },
            }),
          );
          return null;
        }

        // 예상 거래비용(수수료+슬리피지)보다 작은 조정은 생략
        if (
          !passesCostGate(
            deltaWeight,
            this.ESTIMATED_FEE_RATE,
            this.ESTIMATED_SLIPPAGE_RATE,
            this.COST_GUARD_MULTIPLIER,
          )
        ) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.skip_cost_gate', {
              args: {
                symbol: inference.symbol,
                deltaWeight,
                minEdge: (this.ESTIMATED_FEE_RATE + this.ESTIMATED_SLIPPAGE_RATE) * this.COST_GUARD_MULTIPLIER,
              },
            }),
          );
          return null;
        }

        const diff = calculateRelativeDiff(targetWeight, currentWeight);
        if (!Number.isFinite(diff) || Math.abs(diff) < Number.EPSILON) {
          return null;
        }

        this.logger.log(
          this.i18n.t('logging.inference.allocationRecommendation.trade_delta', {
            args: {
              symbol: inference.symbol,
              targetWeight,
              currentWeight,
              deltaWeight,
              diff,
            },
          }),
        );

        if (
          diff < 0 &&
          !isSellAmountSufficient(inference.symbol, diff, UPBIT_MINIMUM_TRADE_PRICE, tradableMarketValueMap)
        ) {
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
   * - diff를 -1로 설정하여 즉시 매도하도록 합니다.
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
    allowBackfill: boolean = true,
  ): TradeRequest[] {
    const categoryItemCountConfig = {
      coinMajorItemCount: this.COIN_MAJOR_ITEM_COUNT,
      coinMinorItemCount: this.COIN_MINOR_ITEM_COUNT,
      nasdaqItemCount: this.NASDAQ_ITEM_COUNT,
    };
    const includedAllocationRecommendations = filterIncludedRecommendationsByCategory(inferences, {
      minimumTradeIntensity: this.MINIMUM_TRADE_INTENSITY,
      minAllocationConfidence: this.MIN_ALLOCATION_CONFIDENCE,
      categoryItemCountConfig,
    }).filter((inference) => allowBackfill || inference.hasStock);

    // 편출 대상 종목 선정:
    // 1. 편입 대상 중 count개를 초과한 종목들 (slice(count))
    // 2. 편출 대상 종목들 (편입 대상에 포함되지 않은 종목)
    const filteredAllocationRecommendations = [
      ...includedAllocationRecommendations.slice(count),
      ...filterExcludedRecommendationsByCategory(inferences, {
        minimumTradeIntensity: this.MINIMUM_TRADE_INTENSITY,
        minAllocationConfidence: this.MIN_ALLOCATION_CONFIDENCE,
        categoryItemCountConfig,
      }),
    ];

    // 편출 거래 요청 생성: 모두 완전 매도(diff: -1)
    const tradeRequests: TradeRequest[] = filteredAllocationRecommendations
      .filter(
        (inference) =>
          isOrderableSymbol(inference.symbol, orderableSymbols) &&
          isSellAmountSufficient(inference.symbol, -1, UPBIT_MINIMUM_TRADE_PRICE, tradableMarketValueMap),
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
   * Builds no trade trim requests used in the allocation recommendation flow.
   * @param balances - Input value for balances.
   * @param inferences - Input value for inferences.
   * @param count - Input value for count.
   * @param regimeMultiplier - Input value for regime multiplier.
   * @param currentWeights - Input value for current weights.
   * @param marketPrice - Input value for market price.
   * @param orderableSymbols - Asset symbol to process.
   * @param tradableMarketValueMap - Input value for tradable market value map.
   * @param allowBackfill - Input value for allow backfill.
   * @returns Processed collection for downstream workflow steps.
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
    allowBackfill: boolean = true,
  ): TradeRequest[] {
    const topK = Math.max(1, count);

    return inferences
      .filter(
        (inference) =>
          (allowBackfill || inference.hasStock) &&
          inference.hasStock &&
          isNoTradeRecommendation(inference, this.MIN_ALLOCATION_CONFIDENCE),
      )
      .map((inference) => {
        if (!isOrderableSymbol(inference.symbol, orderableSymbols)) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'not_orderable',
              },
            }),
          );
          return null;
        }

        if (inference.modelTargetWeight == null || !Number.isFinite(inference.modelTargetWeight)) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'missing_target_weight',
              },
            }),
          );
          return null;
        }

        const targetWeight = clamp01(clamp01(inference.modelTargetWeight) * regimeMultiplier) / topK;
        const currentWeight = currentWeights.get(inference.symbol) ?? 0;
        const deltaWeight = targetWeight - currentWeight;
        if (deltaWeight >= 0) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'not_overweight',
                targetWeight,
                currentWeight,
                deltaWeight,
              },
            }),
          );
          return null;
        }

        if (!shouldReallocate(targetWeight, deltaWeight, this.MIN_ALLOCATION_BAND, this.ALLOCATION_BAND_RATIO)) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'allocation_band',
                targetWeight,
                currentWeight,
                deltaWeight,
                requiredBand: calculateAllocationBand(
                  targetWeight,
                  this.MIN_ALLOCATION_BAND,
                  this.ALLOCATION_BAND_RATIO,
                ),
              },
            }),
          );
          return null;
        }

        if (
          !passesCostGate(
            deltaWeight,
            this.ESTIMATED_FEE_RATE,
            this.ESTIMATED_SLIPPAGE_RATE,
            this.COST_GUARD_MULTIPLIER,
          )
        ) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'cost_gate',
                deltaWeight,
                minEdge: (this.ESTIMATED_FEE_RATE + this.ESTIMATED_SLIPPAGE_RATE) * this.COST_GUARD_MULTIPLIER,
              },
            }),
          );
          return null;
        }

        const diff = calculateRelativeDiff(targetWeight, currentWeight);
        if (!Number.isFinite(diff) || diff >= 0 || Math.abs(diff) < Number.EPSILON) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'invalid_diff',
                targetWeight,
                currentWeight,
                diff,
              },
            }),
          );
          return null;
        }

        if (!isSellAmountSufficient(inference.symbol, diff, UPBIT_MINIMUM_TRADE_PRICE, tradableMarketValueMap)) {
          this.logger.log(
            this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'minimum_sell_amount',
                diff,
              },
            }),
          );
          return null;
        }

        this.logger.log(
          this.i18n.t('logging.inference.allocationRecommendation.no_trade_trim', {
            args: {
              symbol: inference.symbol,
              targetWeight,
              currentWeight,
              deltaWeight,
              diff,
            },
          }),
        );

        return {
          symbol: inference.symbol,
          diff,
          balances,
          marketPrice,
          inference,
        };
      })
      .filter((item): item is TradeRequest => item !== null)
      .sort((a, b) => a.diff - b.diff);
  }

  /**
   * Calculates model signals for the allocation recommendation flow.
   * @param intensity - Input value for intensity.
   * @param category - Input value for category.
   * @param marketFeatures - Input value for market features.
   * @param symbol - Asset symbol to process.
   * @returns Result produced by the allocation recommendation flow.
   */
  private calculateModelSignals(
    intensity: number,
    category: Category,
    marketFeatures: MarketFeatures | null,
    symbol?: string,
  ) {
    const { featureScore, buyScore, sellScore, modelTargetWeight, action } = calculateAllocationModelSignals({
      intensity,
      marketFeatures,
      featureScoreConfig: {
        featureConfidenceWeight: this.FEATURE_CONFIDENCE_WEIGHT,
        featureMomentumWeight: this.FEATURE_MOMENTUM_WEIGHT,
        featureLiquidityWeight: this.FEATURE_LIQUIDITY_WEIGHT,
        featureVolatilityWeight: this.FEATURE_VOLATILITY_WEIGHT,
        featureStabilityWeight: this.FEATURE_STABILITY_WEIGHT,
        volatilityReference: this.VOLATILITY_REFERENCE,
      },
      aiSignalWeight: this.AI_SIGNAL_WEIGHT,
      featureSignalWeight: this.FEATURE_SIGNAL_WEIGHT,
      minimumTradeIntensity: this.MINIMUM_TRADE_INTENSITY,
      sellScoreThreshold: this.SELL_SCORE_THRESHOLD,
    });
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
   * Normalizes neutral model target weight for the allocation recommendation flow.
   * @param previousModelTargetWeight - Input value for previous model target weight.
   * @param suggestedWeight - Input value for suggested weight.
   * @param fallbackModelTargetWeight - Input value for fallback model target weight.
   * @param hasStock - Input value for has stock.
   * @returns Computed numeric value for the operation.
   */
  private resolveNeutralModelTargetWeight(
    previousModelTargetWeight: number | null | undefined,
    suggestedWeight: number | null | undefined,
    fallbackModelTargetWeight: number,
    hasStock: boolean,
  ): number {
    const candidates = [previousModelTargetWeight, suggestedWeight, fallbackModelTargetWeight];

    for (const candidate of candidates) {
      if (!Number.isFinite(candidate)) {
        continue;
      }

      const clamped = clamp01(Number(candidate));
      if (hasStock && clamped <= 0) {
        continue;
      }

      return clamped;
    }

    return hasStock ? this.MIN_RECOMMEND_WEIGHT : 0;
  }

  /**
   * Calculates target weight for the allocation recommendation flow.
   * @param inference - Input value for inference.
   * @param regimeMultiplier - Input value for regime multiplier.
   * @returns Computed numeric value for the operation.
   */
  private calculateTargetWeight(inference: AllocationRecommendationData, regimeMultiplier: number): number {
    const baseTargetWeight =
      inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)
        ? clamp01(inference.modelTargetWeight)
        : this.calculateModelSignals(inference.intensity, inference.category, null, inference.symbol).modelTargetWeight;

    const modelTargetWeight = calculateRegimeAdjustedTargetWeight(baseTargetWeight, regimeMultiplier);
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
   * 메이저 코인 추론 항목 생성
   *
   * - BTC/KRW, ETH/KRW 등 메이저 코인을 추론 대상으로 추가합니다.
   *
   * @returns 메이저 코인 추론 항목 목록
   */
  private async fetchMajorCoinItems(): Promise<RecommendationItem[]> {
    return this.COIN_MAJOR.map((symbol) => ({
      symbol,
      category: Category.COIN_MAJOR,
      hasStock: false,
    }));
  }

  /**
   * 시장 시그널 기반 추론 항목 생성
   *
   * - MarketIntelligence 모듈에서 추천한 종목들을 추론 대상으로 추가합니다.
   * - 최신 추천 결과를 조회하여 RecommendationItem 형식으로 변환합니다.
   *
   * @returns 시장 시그널 기반 추론 항목 목록
   */
  private isLatestRecommendationStateFresh(state: MarketSignalState | null): boolean {
    if (!state) {
      return false;
    }

    if (!Number.isFinite(state.updatedAt)) {
      return false;
    }

    return Date.now() - state.updatedAt <= MARKET_SIGNAL_STATE_MAX_AGE_MS;
  }

  /**
   * Checks recommendations newer than state in the allocation recommendation context.
   * @param recommendations - Input value for recommendations.
   * @param state - Input value for state.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  private hasRecommendationsNewerThanState(recommendations: MarketSignal[], state: MarketSignalState): boolean {
    return recommendations.some((recommendation) => {
      const createdAt =
        recommendation.createdAt instanceof Date
          ? recommendation.createdAt.getTime()
          : new Date(recommendation.createdAt).getTime();

      return Number.isFinite(createdAt) && createdAt > state.updatedAt;
    });
  }

  /**
   * Checks different recommendation batch in the allocation recommendation context.
   * @param recommendations - Input value for recommendations.
   * @param state - Input value for state.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  private hasDifferentRecommendationBatch(recommendations: MarketSignal[], state: MarketSignalState): boolean {
    if (recommendations.length < 1) {
      return false;
    }

    return recommendations[0].batchId !== state.batchId;
  }

  /**
   * Retrieves recommend items for the allocation recommendation flow.
   * @returns Processed collection for downstream workflow steps.
   */
  private async fetchRecommendItems(): Promise<RecommendationItem[]> {
    let latestState: MarketSignalState | null = null;

    try {
      latestState = await this.cacheService.get<MarketSignalState>(MARKET_SIGNAL_STATE_CACHE_KEY);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.schedule.allocationRecommendation.state_cache_read_failed'), error);
    }

    let recommendations: MarketSignal[];

    if (!latestState?.batchId || !this.isLatestRecommendationStateFresh(latestState)) {
      this.logger.warn(this.i18n.t('logging.schedule.allocationRecommendation.state_stale_fallback'));
      recommendations = await MarketSignal.getLatestSignals();
    } else if (!latestState.hasRecommendations) {
      const latestRecommendations = await MarketSignal.getLatestSignals();
      if (!this.hasRecommendationsNewerThanState(latestRecommendations, latestState)) {
        return [];
      }

      recommendations = latestRecommendations;
    } else {
      recommendations = await MarketSignal.find({
        where: { batchId: latestState.batchId },
      });

      const latestRecommendations = await MarketSignal.getLatestSignals();
      const hasNewerRecommendations = this.hasRecommendationsNewerThanState(latestRecommendations, latestState);
      const hasDifferentBatch = this.hasDifferentRecommendationBatch(latestRecommendations, latestState);

      if (recommendations.length < 1 || hasNewerRecommendations || hasDifferentBatch) {
        recommendations = latestRecommendations;
      }
    }

    const minRecommendConfidence = await this.resolveMinRecommendConfidence();

    const minimumFilteredOutRecommendations = recommendations.filter(
      (recommendation) =>
        Number(recommendation.weight) < this.MIN_RECOMMEND_WEIGHT ||
        Number(recommendation.confidence) < minRecommendConfidence,
    );

    if (minimumFilteredOutRecommendations.length > 0) {
      this.logger.log(
        this.i18n.t('logging.schedule.allocationRecommendation.minimum_filtered', {
          args: {
            count: minimumFilteredOutRecommendations.length,
            symbols: minimumFilteredOutRecommendations.map((recommendation) => recommendation.symbol).join(', '),
          },
        }),
      );
    }

    const filteredRecommendations = recommendations
      .filter(
        (recommendation) =>
          Number(recommendation.weight) >= this.MIN_RECOMMEND_WEIGHT &&
          Number(recommendation.confidence) >= minRecommendConfidence,
      )
      .sort((a, b) => Number(b.weight) * Number(b.confidence) - Number(a.weight) * Number(a.confidence));

    const orderableSymbols = await buildOrderableSymbolSet(
      filteredRecommendations.map((recommendation) => recommendation.symbol),
      {
        isSymbolExist: (symbol) => this.upbitService.isSymbolExist(symbol),
        onAllCheckFailed: () =>
          this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_failed')),
        onPartialCheck: () =>
          this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_partial')),
      },
    );

    return filteredRecommendations
      .filter((recommendation) => isOrderableSymbol(recommendation.symbol, orderableSymbols))
      .map((recommendation) => ({
        symbol: recommendation.symbol,
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: Number(recommendation.weight),
        confidence: Number(recommendation.confidence),
      }));
  }

  /**
   * Normalizes min recommend confidence for the allocation recommendation flow.
   * @returns Computed numeric value for the operation.
   */
  private async resolveMinRecommendConfidence(): Promise<number> {
    try {
      const tunedConfidence = await this.allocationAuditService.getRecommendedMarketMinConfidenceForAllocation();
      if (!Number.isFinite(tunedConfidence)) {
        return this.MIN_RECOMMEND_CONFIDENCE;
      }
      return clamp01(tunedConfidence);
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.schedule.allocationRecommendation.minimum_confidence_resolve_failed', {
          args: {
            error: stringifyUnknownError(error),
          },
        }),
        error,
      );
      return this.MIN_RECOMMEND_CONFIDENCE;
    }
  }

  /**
   * 블랙리스트 필터링
   *
   * - 중복 종목 제거 및 블랙리스트에 등록된 종목을 제외합니다.
   *
   * @param items 추론 대상 종목 목록
   * @returns 필터링된 추론 대상 종목 목록
   */
  private async filterAllocationRecommendations(items: RecommendationItem[]): Promise<RecommendationItem[]> {
    const blacklist = await this.blacklistService.findAll();
    const { items: filteredItems, filteredSymbols } = filterUniqueNonBlacklistedItems(items, blacklist);

    if (filteredSymbols.length > 0) {
      this.logger.log(
        this.i18n.t('logging.schedule.allocationRecommendation.blacklist_filtered', {
          args: {
            count: filteredSymbols.length,
            symbols: filteredSymbols.join(', '),
          },
        }),
      );
    }

    return filteredItems;
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
    const latestRecommendationMetricsBySymbol = await buildLatestAllocationRecommendationMetricsMap({
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
            await buildAllocationRecommendationPromptMessages({
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
          const normalizedResponse = normalizeAllocationRecommendationResponsePayload(responseData, {
            expectedSymbol: targetSymbol,
            onSymbolMismatch: ({ outputSymbol, expectedSymbol }) => {
              this.logger.warn(
                this.i18n.t('logging.inference.allocationRecommendation.symbol_mismatch_fallback', {
                  args: {
                    outputSymbol,
                    expectedSymbol,
                  },
                }),
              );
            },
          });
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

          let action: AllocationRecommendationAction = modelSignals.action;
          let modelTargetWeight = clamp01(modelSignals.modelTargetWeight);
          const neutralModelTargetWeight = this.resolveNeutralModelTargetWeight(
            latestMetricsBySymbol?.modelTargetWeight ?? null,
            item?.weight,
            modelTargetWeight,
            item?.hasStock || false,
          );

          if (normalizedResponse.action === 'sell') {
            action = 'sell';
            modelTargetWeight = 0;
          } else if (normalizedResponse.action === 'buy') {
            action = 'buy';
            modelTargetWeight = Math.max(modelTargetWeight, clamp01(safeIntensity));
          } else if (normalizedResponse.action === 'hold') {
            action = 'hold';
            modelTargetWeight = neutralModelTargetWeight;
          } else if (normalizedResponse.action === 'no_trade') {
            action = 'no_trade';
            modelTargetWeight = neutralModelTargetWeight;
          }

          if (decisionConfidence < this.MIN_ALLOCATION_CONFIDENCE) {
            action = 'no_trade';
            modelTargetWeight = neutralModelTargetWeight;
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
   * 잔고 추천 결과 페이지네이션
   *
   * @param params 페이지네이션 파라미터
   * @returns 페이지네이션된 잔고 추천 결과
   */
  public async paginateAllocationRecommendations(
    params: GetAllocationRecommendationsPaginationDto,
  ): Promise<PaginatedItem<AllocationRecommendationDto>> {
    const paginatedResult = await AllocationRecommendation.paginate(params);
    const badgeMap = await this.getAllocationValidationBadgeMapSafe(paginatedResult.items.map((entity) => entity.id));
    const items = await Promise.all(
      paginatedResult.items.map(async (entity) => ({
        id: entity.id,
        symbol: entity.symbol,
        category: entity.category,
        intensity: entity.intensity,
        prevIntensity: entity.prevIntensity != null ? Number(entity.prevIntensity) : null,
        prevModelTargetWeight: await this.findPreviousModelTargetWeight(entity),
        buyScore: entity.buyScore,
        sellScore: entity.sellScore,
        modelTargetWeight: entity.modelTargetWeight,
        action: entity.action,
        reason: entity.reason != null ? toUserFacingText(entity.reason) : null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        btcDominance: entity.btcDominance ?? null,
        altcoinIndex: entity.altcoinIndex ?? null,
        marketRegimeAsOf: entity.marketRegimeAsOf ?? null,
        marketRegimeSource: entity.marketRegimeSource ?? null,
        marketRegimeIsStale: entity.marketRegimeIsStale ?? null,
        feargreedIndex: entity.feargreedIndex ?? null,
        feargreedClassification: entity.feargreedClassification ?? null,
        feargreedTimestamp: entity.feargreedTimestamp ?? null,
        validation24h: badgeMap.get(entity.id)?.validation24h,
        validation72h: badgeMap.get(entity.id)?.validation72h,
      })),
    );

    return {
      ...paginatedResult,
      items,
    };
  }

  /**
   * 잔고 추천 결과 커서 페이지네이션
   *
   * @param params 커서 페이지네이션 파라미터
   * @returns 커서 페이지네이션된 잔고 추천 결과
   */
  public async cursorAllocationRecommendations(
    params: GetAllocationRecommendationsCursorDto,
  ): Promise<CursorItem<AllocationRecommendationDto, string>> {
    const cursorResult = await AllocationRecommendation.cursor(params);
    const badgeMap = await this.getAllocationValidationBadgeMapSafe(cursorResult.items.map((entity) => entity.id));
    const items = await Promise.all(
      cursorResult.items.map(async (entity) => ({
        id: entity.id,
        symbol: entity.symbol,
        category: entity.category,
        intensity: entity.intensity,
        prevIntensity: entity.prevIntensity != null ? Number(entity.prevIntensity) : null,
        prevModelTargetWeight: await this.findPreviousModelTargetWeight(entity),
        buyScore: entity.buyScore,
        sellScore: entity.sellScore,
        modelTargetWeight: entity.modelTargetWeight,
        action: entity.action,
        reason: entity.reason != null ? toUserFacingText(entity.reason) : null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        btcDominance: entity.btcDominance ?? null,
        altcoinIndex: entity.altcoinIndex ?? null,
        marketRegimeAsOf: entity.marketRegimeAsOf ?? null,
        marketRegimeSource: entity.marketRegimeSource ?? null,
        marketRegimeIsStale: entity.marketRegimeIsStale ?? null,
        feargreedIndex: entity.feargreedIndex ?? null,
        feargreedClassification: entity.feargreedClassification ?? null,
        feargreedTimestamp: entity.feargreedTimestamp ?? null,
        validation24h: badgeMap.get(entity.id)?.validation24h,
        validation72h: badgeMap.get(entity.id)?.validation72h,
      })),
    );

    return {
      ...cursorResult,
      items,
    };
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

  /**
   * Handles find previous model target weight in the allocation recommendation workflow.
   * @param entity - Input value for entity.
   * @returns Computed numeric value for the operation.
   */
  private async findPreviousModelTargetWeight(entity: AllocationRecommendation): Promise<number | null> {
    try {
      const previous = await AllocationRecommendation.createQueryBuilder('recommendation')
        .select(['recommendation.modelTargetWeight'])
        .where('recommendation.symbol = :symbol', { symbol: entity.symbol })
        .andWhere('recommendation.category = :category', { category: entity.category })
        .andWhere('recommendation.id < :id', { id: entity.id })
        .orderBy('recommendation.id', 'DESC')
        .getOne();

      if (previous?.modelTargetWeight != null && Number.isFinite(previous.modelTargetWeight)) {
        return Number(previous.modelTargetWeight);
      }
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.inference.allocationRecommendation.prev_target_weight_failed', {
          args: { symbol: entity.symbol, id: entity.id },
        }),
        error,
      );
    }

    return null;
  }

  /**
   * Retrieves allocation validation badge map safe for the allocation recommendation flow.
   * @param ids - Identifier for the target resource.
   * @returns Result produced by the allocation recommendation flow.
   */
  private async getAllocationValidationBadgeMapSafe(ids: string[]) {
    try {
      return await this.allocationAuditService.getAllocationValidationBadgeMap(ids);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.validation_badges_load_failed'), error);
      return new Map();
    }
  }
}
