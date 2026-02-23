import { Message, SQSClient } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

import { TradeExecutionModule } from '@/modules/trade-execution-ledger/trade-execution-ledger.enum';
import { TradeExecutionLedgerAcquireResult } from '@/modules/trade-execution-ledger/trade-execution-ledger.interface';

import { JsonRecord, readStringValue, stringifyUnknownError, tryParseJsonRecord } from './sqs-message';
import { deleteSqsMessage } from './sqs-processing';

interface TradeExecutionLedgerFailureRecorder {
  hashPayload(payload: unknown): string;
  acquire(context: {
    module: TradeExecutionModule;
    messageKey: string;
    userId: string;
    payloadHash: string;
    generatedAt: Date;
    expiresAt: Date;
  }): Promise<TradeExecutionLedgerAcquireResult>;
  markNonRetryableFailed(context: {
    module: TradeExecutionModule;
    messageKey: string;
    userId: string;
    attemptCount: number;
    error: string;
  }): Promise<void>;
}

interface MarkMalformedMessageAsNonRetryableOptions {
  message: Message;
  module: TradeExecutionModule;
  messageTtlMs: number;
  sqs: SQSClient;
  queueUrl: string;
  ledgerService: TradeExecutionLedgerFailureRecorder;
  resolveUserId(parsed: JsonRecord | null): string;
}

/**
 * Runs malformed message as non retryable in the trade execution ledger workflow.
 * @param options - Configuration for the trade execution ledger flow.
 * @param error - Error captured from a failed operation.
 */
export async function markMalformedMessageAsNonRetryable(
  options: MarkMalformedMessageAsNonRetryableOptions,
  error: unknown,
): Promise<void> {
  const parsed = tryParseJsonRecord(options.message.Body);
  // Synthesize a stable key when producer payload is broken and MessageId is missing.
  const messageKey =
    readStringValue(parsed, 'messageKey') ?? options.message.MessageId ?? `malformed:${Date.now()}:${randomUUID()}`;
  const userId = options.resolveUserId(parsed);
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + options.messageTtlMs);

  const acquireResult = await options.ledgerService.acquire({
    module: options.module,
    messageKey,
    userId,
    payloadHash: options.ledgerService.hashPayload(parsed ?? options.message.Body),
    generatedAt,
    expiresAt,
  });

  // Only first worker writes malformed-failure row; duplicates are already deduped by ledger.
  if (acquireResult.acquired) {
    await options.ledgerService.markNonRetryableFailed({
      module: options.module,
      messageKey,
      userId,
      attemptCount: acquireResult.attemptCount ?? 1,
      error: stringifyUnknownError(error),
    });
  }

  await deleteSqsMessage({
    sqs: options.sqs,
    queueUrl: options.queueUrl,
    message: options.message,
  });
}
