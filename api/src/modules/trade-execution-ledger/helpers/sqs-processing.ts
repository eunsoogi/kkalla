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

export async function deferSqsMessageWhileProcessing(options: DeferSqsMessageWhileProcessingOptions): Promise<void> {
  if (!options.message.ReceiptHandle) {
    return;
  }

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

export async function withProcessingHeartbeat<T>(options: WithProcessingHeartbeatOptions<T>): Promise<T> {
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

export function isMessageExpired(expiresAt: string): boolean {
  const expiresAtTs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now();
}

export function isNonRetryableExecutionError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'NotFoundException';
}
