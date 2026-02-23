import { ChangeMessageVisibilityCommand, DeleteMessageCommand, Message, SQSClient } from '@aws-sdk/client-sqs';

export interface ProcessingLedgerContext {
  module: string;
  messageKey: string;
  userId: string;
  attemptCount?: number;
}

interface DeleteSqsMessageOptions {
  sqs: SQSClient;
  queueUrl: string;
  message: Message;
}

interface DeferSqsMessageWhileProcessingOptions extends DeleteSqsMessageOptions {
  processingStaleMs: number;
  onVisibilityExtendFailed: (error: unknown) => void;
}

interface WithProcessingHeartbeatOptions<T> {
  context: ProcessingLedgerContext;
  heartbeatIntervalMs: number;
  heartbeat: (context: ProcessingLedgerContext) => Promise<void>;
  onHeartbeatFailed: (error: unknown) => void;
  callback: () => Promise<T>;
}

/**
 * Handles delete sqs message in the trade execution ledger workflow.
 * @param options - Configuration for the trade execution ledger flow.
 */
export async function deleteSqsMessage(options: DeleteSqsMessageOptions): Promise<void> {
  if (!options.message.ReceiptHandle) {
    return;
  }

  await options.sqs.send(
    new DeleteMessageCommand({
      QueueUrl: options.queueUrl,
      ReceiptHandle: options.message.ReceiptHandle,
    }),
  );
}

/**
 * Handles defer sqs message while processing in the trade execution ledger workflow.
 * @param options - Configuration for the trade execution ledger flow.
 */
export async function deferSqsMessageWhileProcessing(options: DeferSqsMessageWhileProcessingOptions): Promise<void> {
  if (!options.message.ReceiptHandle) {
    return;
  }

  // Keep message hidden slightly beyond stale threshold to avoid duplicate workers.
  const visibilityTimeout = Math.max(1, Math.ceil(options.processingStaleMs / 1000));

  try {
    await options.sqs.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: options.queueUrl,
        ReceiptHandle: options.message.ReceiptHandle,
        VisibilityTimeout: visibilityTimeout,
      }),
    );
  } catch (error) {
    options.onVisibilityExtendFailed(error);
  }
}

/**
 * Handles with processing heartbeat in the trade execution ledger workflow.
 * @param options - Configuration for the trade execution ledger flow.
 * @returns Asynchronous result produced by the trade execution ledger flow.
 */
export async function withProcessingHeartbeat<T>(options: WithProcessingHeartbeatOptions<T>): Promise<T> {
  // Emit one heartbeat immediately, then keep extending while callback is running.
  await options.heartbeat(options.context);

  const heartbeatTimer = setInterval(() => {
    void options.heartbeat(options.context).catch((error) => {
      options.onHeartbeatFailed(error);
    });
  }, options.heartbeatIntervalMs);
  heartbeatTimer.unref?.();

  try {
    return await options.callback();
  } finally {
    clearInterval(heartbeatTimer);
  }
}

/**
 * Checks message expired in the trade execution ledger context.
 * @param expiresAt - Input value for expires at.
 * @returns Boolean flag that indicates whether the condition is satisfied.
 */
export function isMessageExpired(expiresAt: string): boolean {
  const expiresAtTs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now();
}

/**
 * Checks non retryable execution error in the trade execution ledger context.
 * @param error - Error captured from a failed operation.
 * @returns Boolean flag that indicates whether the condition is satisfied.
 */
export function isNonRetryableExecutionError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'NotFoundException';
}
