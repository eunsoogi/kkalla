import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { Message, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Balances } from 'ccxt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import { CategoryExposureCaps } from '@/modules/allocation-core/allocation-core.types';
import { AllocationSlotService } from '@/modules/allocation-core/allocation-slot.service';
import { toPercentString } from '@/modules/allocation-core/helpers/allocation-recommendation';
import { TradeOrchestrationService } from '@/modules/allocation-core/trade-orchestration.service';
import { CacheService } from '@/modules/cache/cache.service';
import { ErrorService } from '@/modules/error/error.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { CursorItem, PaginatedItem } from '@/modules/item/item.types';
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
} from '../market-intelligence/market-intelligence.types';
import { MarketRegimeService } from '../market-regime/market-regime.service';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TradeExecutionModule } from '../trade-execution-ledger/trade-execution-ledger.enum';
import { TradeExecutionLedgerService } from '../trade-execution-ledger/trade-execution-ledger.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeRequest } from '../trade/trade.types';
import { UpbitService } from '../upbit/upbit.service';
import { MarketFeatures } from '../upbit/upbit.types';
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
} from './allocation.types';
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

  private readonly MISSING_INFERENCE_GRACE_CYCLES = 2;
  private readonly MISSING_INFERENCE_TTL_SECONDS = 60 * 60 * 24;
  private readonly MIN_RECOMMEND_WEIGHT = 0.05;
  private readonly MIN_RECOMMEND_CONFIDENCE = 0.45;
  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;
  private readonly DEFAULT_ALLOCATION_MODE: AllocationMode = 'new';

  // Amazon SQS
  private readonly sqs = createSharedSqsClient();

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
    private readonly allocationSlotService: AllocationSlotService,
    private readonly tradeOrchestrationService: TradeOrchestrationService,
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
    const processingHeartbeatIntervalMs = this.tradeOrchestrationService.getProcessingHeartbeatIntervalMs();
    const messageTtlMs = this.tradeOrchestrationService.getMessageTtlMs();
    const userTradeLockDurationMs = this.tradeOrchestrationService.getUserTradeLockDurationMs();
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));
    await processTradeExecutionMessage<TradeExecutionMessageV2>({
      module: TradeExecutionModule.ALLOCATION,
      message,
      sqs: this.sqs,
      queueUrl: this.queueUrl,
      heartbeatIntervalMs: processingHeartbeatIntervalMs,
      parseMessage: (messageBody) => this.parseAllocationMessage(messageBody),
      onMalformedMessage: async (targetMessage, error) => {
        await markMalformedMessageAsNonRetryable(
          {
            message: targetMessage,
            module: TradeExecutionModule.ALLOCATION,
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
              module: TradeExecutionModule.ALLOCATION,
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
      queueMessageVersion: this.tradeOrchestrationService.getQueueMessageVersion(),
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
      const queueMessageVersion = this.tradeOrchestrationService.getQueueMessageVersion();
      const messageTtlMs = this.tradeOrchestrationService.getMessageTtlMs();
      const runId = randomUUID();
      const generatedAt = new Date();
      const expiresAt = new Date(generatedAt.getTime() + messageTtlMs);
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
              version: queueMessageVersion,
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
    const slotCount = await this.allocationSlotService.resolveAuthorizedSlotCount(user);
    assertLockOrThrow();
    const allowBackfill = allocationMode === 'new';

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

    const referenceSymbols = authorizedRecommendations.map((recommendation) => recommendation.symbol);
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

    // 편입/편출 결정 분리
    // 1. 추론에 없는 기존 보유 종목 매도 요청 (완전 매도)
    const rawNonAllocationRecommendationTradeRequests: TradeRequest[] =
      this.generateNonAllocationRecommendationTradeRequests(
        balances,
        authorizedRecommendations,
        executionSnapshot.marketPrice,
        executionSnapshot.orderableSymbols,
        executionSnapshot.tradableMarketValueMap,
      );
    const nonAllocationRecommendationTradeRequests = await this.applyMissingInferenceGraceWindow(
      user,
      rawNonAllocationRecommendationTradeRequests,
      new Set(authorizedRecommendations.map((recommendation) => recommendation.symbol)),
    );
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
      additionalSellRequests: nonAllocationRecommendationTradeRequests,
      assertLockOrThrow,
      buildExcludedRequests: (snapshot) =>
        this.generateExcludedTradeRequests(
          snapshot.balances,
          authorizedRecommendations,
          slotCount,
          snapshot.marketPrice,
          snapshot.orderableSymbols,
          snapshot.tradableMarketValueMap,
          allowBackfill,
        ),
      buildIncludedRequests: (snapshot) =>
        this.generateIncludedTradeRequests(
          snapshot.balances,
          authorizedRecommendations,
          slotCount,
          regimeMultiplier,
          snapshot.currentWeights,
          snapshot.marketPrice,
          snapshot.orderableSymbols,
          snapshot.tradableMarketValueMap,
          allowBackfill,
          regimePolicy.rebalanceBandMultiplier,
          regimePolicy.categoryExposureCaps,
        ),
      buildNoTradeTrimRequests: (snapshot) =>
        this.generateNoTradeTrimRequests(
          snapshot.balances,
          authorizedRecommendations,
          slotCount,
          regimeMultiplier,
          snapshot.currentWeights,
          snapshot.marketPrice,
          snapshot.orderableSymbols,
          snapshot.tradableMarketValueMap,
          allowBackfill,
          regimePolicy.rebalanceBandMultiplier,
          regimePolicy.categoryExposureCaps,
        ),
    });
  }

  private getMissingInferenceCacheKey(userId: string, symbol: string): string {
    return `allocation:missing-inference:${userId}:${symbol}`;
  }

  /**
   * Increments per-symbol "missing from inference" counter.
   * @param userId - User identifier.
   * @param symbol - Target symbol.
   * @returns Incremented missing counter value.
   */
  private async increaseMissingInferenceCount(userId: string, symbol: string): Promise<number> {
    const cacheKey = this.getMissingInferenceCacheKey(userId, symbol);
    const previous = Number((await this.cacheService.get<number>(cacheKey)) ?? 0);
    const next = Number.isFinite(previous) ? previous + 1 : 1;
    await this.cacheService.set(cacheKey, next, this.MISSING_INFERENCE_TTL_SECONDS);
    return next;
  }

  /**
   * Clears per-symbol missing counter once symbol reappears in inference output.
   * @param userId - User identifier.
   * @param symbol - Target symbol.
   */
  private async clearMissingInferenceCount(userId: string, symbol: string): Promise<void> {
    const cacheKey = this.getMissingInferenceCacheKey(userId, symbol);
    await this.cacheService.del(cacheKey);
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
   * Applies missing-inference grace window before forced liquidation.
   * @param user - User context.
   * @param requests - Missing-inference sell requests.
   * @param includedSymbols - Symbols present in current inference set.
   * @returns Sell requests that passed grace-window gating.
   */
  private async applyMissingInferenceGraceWindow(
    user: User,
    requests: TradeRequest[],
    includedSymbols: Set<string>,
  ): Promise<TradeRequest[]> {
    // Any symbol present in this cycle should reset its missing counter immediately.
    await Promise.all(
      Array.from(includedSymbols).map(async (symbol) => {
        try {
          await this.clearMissingInferenceCount(user.id, symbol);
        } catch (error) {
          this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.missing_clear_failed'), error);
        }
      }),
    );

    const gatedRequests = await Promise.all(
      requests.map(async (request) => {
        try {
          const missingCount = await this.increaseMissingInferenceCount(user.id, request.symbol);
          // Keep holding during grace window to avoid churn from transient inference omissions.
          if (missingCount < this.MISSING_INFERENCE_GRACE_CYCLES) {
            return null;
          }

          return {
            ...request,
            triggerReason: 'missing_inference_grace_elapsed',
          };
        } catch (error) {
          this.logger.warn(this.i18n.t('logging.inference.allocationRecommendation.missing_count_failed'), error);
          return request;
        }
      }),
    );

    return gatedRequests.filter((item): item is TradeRequest => item != null);
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
    return this.tradeOrchestrationService.buildMissingInferenceSellRequests({
      balances,
      inferences,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      triggerReason: 'missing_from_inference',
    });
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
    rebalanceBandMultiplier: number = 1,
    categoryExposureCaps?: CategoryExposureCaps,
  ): TradeRequest[] {
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const candidates = this.tradeOrchestrationService
      .filterIncludedRecommendations(inferences)
      .filter((inference) => allowBackfill || inference.hasStock)
      .slice(0, count);

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
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const includedAllocationRecommendations = this.tradeOrchestrationService
      .filterIncludedRecommendations(inferences)
      .filter((inference) => allowBackfill || inference.hasStock);

    // 편출 대상 종목 선정:
    // 1. 편입 대상 중 count개를 초과한 종목들 (slice(count))
    // 2. 편출 대상 종목들 (편입 대상에 포함되지 않은 종목)
    const filteredAllocationRecommendations = [
      ...includedAllocationRecommendations.slice(count),
      ...this.tradeOrchestrationService.filterExcludedRecommendations(inferences),
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
   * @param allowBackfill - Whether non-held items can enter candidate set.
   * @param rebalanceBandMultiplier - Market-regime rebalance band multiplier.
   * @param categoryExposureCaps - Optional category exposure caps.
   * @returns No-trade trim sell requests.
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
    rebalanceBandMultiplier: number = 1,
    categoryExposureCaps?: CategoryExposureCaps,
  ): TradeRequest[] {
    const tradeRuntime = {
      logger: this.logger,
      i18n: this.i18n,
      exchangeService: this.upbitService,
    };
    const candidates = inferences.filter(
      (inference) =>
        (allowBackfill || inference.hasStock) &&
        inference.hasStock &&
        this.tradeOrchestrationService.isNoTradeRecommendation(inference),
    );

    // Delegate exact diff/band/cost-gate logic to shared orchestration for consistency.
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
   * Calculates model signal bundle and emits telemetry log.
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
   * Resolves target weight for neutral/no-trade outputs.
   * @param previousModelTargetWeight - Previous model target weight.
   * @param suggestedWeight - Suggested target weight from external hint.
   * @param fallbackModelTargetWeight - Model-derived fallback target weight.
   * @param hasStock - Whether the user currently holds the symbol.
   * @returns Normalized neutral target weight.
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

      const clamped = this.tradeOrchestrationService.clampToUnitInterval(Number(candidate));
      if (hasStock && clamped <= 0) {
        continue;
      }

      return clamped;
    }

    return hasStock ? this.MIN_RECOMMEND_WEIGHT : 0;
  }

  /**
   * Resolves final per-symbol target weight.
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

    const orderableSymbols = await this.tradeOrchestrationService.buildOrderableSymbolSet(
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
      .filter((recommendation) =>
        this.tradeOrchestrationService.isOrderableSymbol(recommendation.symbol, orderableSymbols),
      )
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
      return this.tradeOrchestrationService.clampToUnitInterval(tunedConfidence);
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
    const { items: filteredItems, filteredSymbols } = this.tradeOrchestrationService.filterUniqueNonBlacklistedItems(
      items,
      blacklist,
    );

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
            modelTargetWeight = Math.max(
              modelTargetWeight,
              this.tradeOrchestrationService.clampToUnitInterval(safeIntensity),
            );
          } else if (normalizedResponse.action === 'hold') {
            action = 'hold';
            modelTargetWeight = neutralModelTargetWeight;
          } else if (normalizedResponse.action === 'no_trade') {
            action = 'no_trade';
            modelTargetWeight = neutralModelTargetWeight;
          }

          if (decisionConfidence < this.tradeOrchestrationService.getMinimumAllocationConfidence()) {
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
