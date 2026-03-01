import { Message, SQSClient } from '@aws-sdk/client-sqs';

import {
  TradeExecutionLedgerStatus,
  TradeExecutionModule,
} from '@/modules/trade-execution-ledger/trade-execution-ledger.enum';
import { TradeExecutionLedgerAcquireResult } from '@/modules/trade-execution-ledger/trade-execution-ledger.types';

import { hasPositiveAttemptCount, stringifyUnknownError } from './sqs-message';
import {
  ProcessingLedgerContext,
  deferSqsMessageWhileProcessing,
  deleteSqsMessage,
  isMessageExpired,
  withProcessingHeartbeat,
} from './sqs-processing';

interface TradeExecutionMessagePayload {
  module?: string;
  moduleKey?: string;
  messageKey: string;
  userId: string;
  generatedAt: string;
  expiresAt: string;
}

interface TradeExecutionLedgerLike {
  hashPayload(payload: unknown): string;
  acquire(context: {
    module: string;
    messageKey: string;
    userId: string;
    payloadHash: string;
    generatedAt: Date;
    expiresAt: Date;
  }): Promise<TradeExecutionLedgerAcquireResult>;
  markStaleSkipped(context: ProcessingLedgerContext & { error: string }): Promise<void>;
  markSucceeded(context: ProcessingLedgerContext): Promise<void>;
  markRetryableFailed(context: ProcessingLedgerContext & { error: string }): Promise<void>;
  markNonRetryableFailed(context: ProcessingLedgerContext & { error: string }): Promise<void>;
  heartbeatProcessing(context: ProcessingLedgerContext): Promise<void>;
  getProcessingStaleMs(): number;
}

interface LockContext {
  assertLockOrThrow?(): void;
}

interface ProcessTradeExecutionMessageOptions<TMessage extends TradeExecutionMessagePayload> {
  module: TradeExecutionModule;
  message: Message;
  sqs: SQSClient;
  queueUrl: string;
  heartbeatIntervalMs: number;
  parseMessage(messageBody: string | undefined): TMessage;
  onMalformedMessage(message: Message, error: unknown): Promise<void>;
  ledgerService: TradeExecutionLedgerLike;
  withUserLock<T>(userId: string, callback: (lockContext: LockContext | undefined) => Promise<T>): Promise<T | false>;
  executeLocked(message: TMessage, assertLockOrThrow: () => void): Promise<void>;
  isNonRetryableExecutionError(error: unknown): boolean;
  onSkippedProcessing(messageKey: string): void;
  onVisibilityExtendFailed(message: Message, error: unknown): void;
  onHeartbeatFailed(context: ProcessingLedgerContext, error: unknown): void;
  onComplete(messageId: string | undefined): void;
  onError(messageId: string | undefined, error: unknown): void;
}

/**
 * Runs trade execution message in the trade execution ledger workflow.
 * @param options - Configuration for the trade execution ledger flow.
 */
export async function processTradeExecutionMessage<TMessage extends TradeExecutionMessagePayload>(
  options: ProcessTradeExecutionMessageOptions<TMessage>,
): Promise<void> {
  let parsedMessage: TMessage;
  try {
    parsedMessage = options.parseMessage(options.message.Body);
  } catch (error) {
    await options.onMalformedMessage(options.message, error);
    return;
  }

  // Canonical module key keeps dedupe stable across renamed module labels.
  const dedupeModuleKey = resolveDedupeModuleKey(parsedMessage, options.module);
  const ledgerContext: ProcessingLedgerContext = {
    module: dedupeModuleKey,
    messageKey: parsedMessage.messageKey,
    userId: parsedMessage.userId,
  };
  let processingLedgerContext: ProcessingLedgerContext = ledgerContext;
  let succeeded = false;

  try {
    const acquired = await options.ledgerService.acquire({
      ...ledgerContext,
      payloadHash: options.ledgerService.hashPayload(parsedMessage),
      generatedAt: new Date(parsedMessage.generatedAt),
      expiresAt: new Date(parsedMessage.expiresAt),
    });

    if (!acquired.acquired) {
      // Already-processing messages are deferred; terminal duplicates are discarded.
      if (acquired.status === TradeExecutionLedgerStatus.PROCESSING) {
        options.onSkippedProcessing(parsedMessage.messageKey);
        await deferSqsMessageWhileProcessing({
          sqs: options.sqs,
          queueUrl: options.queueUrl,
          message: options.message,
          processingStaleMs: options.ledgerService.getProcessingStaleMs(),
          onVisibilityExtendFailed: (error) => options.onVisibilityExtendFailed(options.message, error),
        });
        return;
      }

      await deleteSqsMessage({
        sqs: options.sqs,
        queueUrl: options.queueUrl,
        message: options.message,
      });
      return;
    }

    processingLedgerContext = {
      ...ledgerContext,
      attemptCount: acquired.attemptCount ?? 1,
    };

    // Skip stale queue items after ledger acquire so expiry gets persisted once.
    if (isMessageExpired(parsedMessage.expiresAt)) {
      await options.ledgerService.markStaleSkipped({
        ...processingLedgerContext,
        error: 'Message expired',
      });
      await deleteSqsMessage({
        sqs: options.sqs,
        queueUrl: options.queueUrl,
        message: options.message,
      });
      return;
    }

    // Run trade execution under user lock and periodic processing heartbeats.
    const lockResult = await options.withUserLock(parsedMessage.userId, async (lockContext) =>
      withProcessingHeartbeat({
        context: processingLedgerContext,
        heartbeatIntervalMs: options.heartbeatIntervalMs,
        heartbeat: (context) => options.ledgerService.heartbeatProcessing(context),
        onHeartbeatFailed: (error) => options.onHeartbeatFailed(processingLedgerContext, error),
        callback: async () => {
          const assertLockOrThrow = () => {
            lockContext?.assertLockOrThrow?.();
          };
          await options.executeLocked(parsedMessage, assertLockOrThrow);
          return true;
        },
      }),
    );

    if (!lockResult) {
      options.onSkippedProcessing(parsedMessage.messageKey);
      await deferSqsMessageWhileProcessing({
        sqs: options.sqs,
        queueUrl: options.queueUrl,
        message: options.message,
        processingStaleMs: options.ledgerService.getProcessingStaleMs(),
        onVisibilityExtendFailed: (error) => options.onVisibilityExtendFailed(options.message, error),
      });
      return;
    }

    await options.ledgerService.markSucceeded(processingLedgerContext);
    succeeded = true;
    options.onComplete(options.message.MessageId);
    await deleteSqsMessage({
      sqs: options.sqs,
      queueUrl: options.queueUrl,
      message: options.message,
    });
  } catch (error) {
    options.onError(options.message.MessageId, error);

    // Success state already persisted; do not overwrite ledger status in fallback path.
    if (succeeded) {
      throw error;
    }

    // Without attempt count we cannot safely write failure metadata.
    if (!hasPositiveAttemptCount(processingLedgerContext)) {
      throw error;
    }

    if (options.isNonRetryableExecutionError(error)) {
      await options.ledgerService.markNonRetryableFailed({
        ...processingLedgerContext,
        error: stringifyUnknownError(error),
      });
      await deleteSqsMessage({
        sqs: options.sqs,
        queueUrl: options.queueUrl,
        message: options.message,
      });
      return;
    }

    await options.ledgerService.markRetryableFailed({
      ...processingLedgerContext,
      error: stringifyUnknownError(error),
    });
    throw error;
  }
}

/**
 * Normalizes dedupe module key for the trade execution ledger flow.
 * @param parsedMessage - Message payload handled by the trade execution ledger flow.
 * @param fallbackModule - Input value for fallback module.
 * @returns Formatted string output for the operation.
 */
function resolveDedupeModuleKey<TMessage extends TradeExecutionMessagePayload>(
  parsedMessage: TMessage,
  fallbackModule: TradeExecutionModule,
): string {
  const moduleKey = parsedMessage.moduleKey ?? parsedMessage.module;
  if (typeof moduleKey === 'string' && moduleKey.length > 0) {
    return normalizeModuleKey(moduleKey, fallbackModule);
  }

  return fallbackModule;
}

/**
 * Normalizes module key for the trade execution ledger flow.
 * @param moduleKey - Input value for module key.
 * @param fallbackModule - Input value for fallback module.
 * @returns Result produced by the trade execution ledger flow.
 */
function normalizeModuleKey(moduleKey: string, fallbackModule: TradeExecutionModule): TradeExecutionModule {
  // Legacy module names are normalized to the post-refactor canonical modules.
  if (moduleKey === TradeExecutionModule.ALLOCATION || moduleKey === 'rebalance') {
    return TradeExecutionModule.ALLOCATION;
  }
  if (moduleKey === TradeExecutionModule.RISK || moduleKey === 'volatility') {
    return TradeExecutionModule.RISK;
  }

  return fallbackModule;
}
