import {
  deferSqsMessageWhileProcessing,
  deleteSqsMessage,
  isMessageExpired,
  isNonRetryableExecutionError,
  withProcessingHeartbeat,
} from './sqs-processing';

describe('sqs-processing utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should delete sqs message when receipt handle exists', async () => {
    const sqs = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    await deleteSqsMessage({
      sqs: sqs as any,
      queueUrl: 'queue-url',
      message: { ReceiptHandle: 'rh-1' } as any,
    });

    expect(sqs.send).toHaveBeenCalledTimes(1);
    const command = sqs.send.mock.calls[0][0];
    expect(command.input).toEqual({
      QueueUrl: 'queue-url',
      ReceiptHandle: 'rh-1',
    });
  });

  it('should defer message visibility and report error when extension fails', async () => {
    const error = new Error('visibility failed');
    const onVisibilityExtendFailed = jest.fn();
    const sqs = {
      send: jest.fn().mockRejectedValue(error),
    };

    await deferSqsMessageWhileProcessing({
      sqs: sqs as any,
      queueUrl: 'queue-url',
      message: { MessageId: 'm-1', ReceiptHandle: 'rh-1' } as any,
      processingStaleMs: 1500,
      onVisibilityExtendFailed,
    });

    expect(sqs.send).toHaveBeenCalledTimes(1);
    const command = sqs.send.mock.calls[0][0];
    expect(command.input).toEqual({
      QueueUrl: 'queue-url',
      ReceiptHandle: 'rh-1',
      VisibilityTimeout: 2,
    });
    expect(onVisibilityExtendFailed).toHaveBeenCalledWith(error);
  });

  it('should run callback with heartbeat and forward heartbeat failures', async () => {
    jest.useFakeTimers();

    const onHeartbeatFailed = jest.fn();
    const heartbeat = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('heartbeat failed'));

    const resultPromise = withProcessingHeartbeat({
      context: {
        module: 'allocation' as any,
        messageKey: 'message-key',
        userId: 'user-id',
      },
      heartbeatIntervalMs: 5,
      heartbeat,
      onHeartbeatFailed,
      callback: async () => {
        await jest.advanceTimersByTimeAsync(6);
        await Promise.resolve();
        return 'done';
      },
    });

    const result = await resultPromise;

    expect(result).toBe('done');
    expect(heartbeat).toHaveBeenCalledTimes(2);
    expect(onHeartbeatFailed).toHaveBeenCalledTimes(1);
  });

  it('should evaluate expiration and non-retryable error predicates', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    expect(isMessageExpired(new Date(now - 1).toISOString())).toBe(true);
    expect(isMessageExpired(new Date(now + 10_000).toISOString())).toBe(false);
    expect(isNonRetryableExecutionError({ name: 'NotFoundException' })).toBe(true);
    expect(isNonRetryableExecutionError({ name: 'OtherError' })).toBe(false);
  });
});
