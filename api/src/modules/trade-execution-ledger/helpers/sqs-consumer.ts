import { Message, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

interface SqsConsumerLogger {
  log(message: string): void;
  error(message: string, trace?: unknown): void;
}

interface SqsConsumerMessages {
  onStart: string;
  onRestart: string;
  onError: (error: unknown) => string;
  onProcessing: (count: number) => string;
}

interface SqsConsumerOptions {
  sqs: SQSClient;
  queueUrl: string;
  logger: SqsConsumerLogger;
  messages: SqsConsumerMessages;
  onMessage: (message: Message) => Promise<void>;
  maxNumberOfMessages?: number;
  waitTimeSeconds?: number;
  restartDelayMs?: number;
}

export function startSqsConsumer(options: SqsConsumerOptions): void {
  options.logger.log(options.messages.onStart);

  void consumeSqsMessages(options).catch((error) => {
    options.logger.error(options.messages.onError(error));
    options.logger.log(options.messages.onRestart);

    const restartTimer = setTimeout(() => {
      startSqsConsumer(options);
    }, options.restartDelayMs ?? 5_000);
    restartTimer.unref?.();
  });
}

async function consumeSqsMessages(options: SqsConsumerOptions): Promise<void> {
  options.logger.log(options.messages.onStart);

  while (true) {
    try {
      const result = await options.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: options.queueUrl,
          MaxNumberOfMessages: options.maxNumberOfMessages ?? 10,
          WaitTimeSeconds: options.waitTimeSeconds ?? 20,
        }),
      );

      if (!result.Messages?.length) {
        continue;
      }

      options.logger.log(options.messages.onProcessing(result.Messages.length));
      await Promise.all(result.Messages.map((message) => options.onMessage(message)));
    } catch (error) {
      options.logger.error(options.messages.onError(error));
    }
  }
}
