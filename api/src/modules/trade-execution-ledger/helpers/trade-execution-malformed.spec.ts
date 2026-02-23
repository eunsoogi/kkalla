import { TradeExecutionModule } from '@/modules/trade-execution-ledger/trade-execution-ledger.enum';

import { markMalformedMessageAsNonRetryable } from './trade-execution-malformed';

describe('trade-execution-malformed utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should mark malformed message as non-retryable when ledger acquire succeeds', async () => {
    const sqs = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const ledgerService = {
      hashPayload: jest.fn().mockReturnValue('payload-hash'),
      acquire: jest.fn().mockResolvedValue({ acquired: true, attemptCount: 2 }),
      markNonRetryableFailed: jest.fn().mockResolvedValue(undefined),
    };

    await markMalformedMessageAsNonRetryable(
      {
        message: {
          MessageId: 'm-1',
          Body: JSON.stringify({ userId: 'user-1' }),
          ReceiptHandle: 'rh-1',
        } as any,
        module: TradeExecutionModule.ALLOCATION,
        messageTtlMs: 60_000,
        sqs: sqs as any,
        queueUrl: 'queue-url',
        ledgerService: ledgerService as any,
        resolveUserId: (parsed) => (parsed?.userId as string) ?? 'unknown',
      },
      new Error('parse failed'),
    );

    expect(ledgerService.acquire).toHaveBeenCalledTimes(1);
    expect(ledgerService.markNonRetryableFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        module: TradeExecutionModule.ALLOCATION,
        messageKey: 'm-1',
        userId: 'user-1',
        attemptCount: 2,
      }),
    );
    expect(sqs.send).toHaveBeenCalledTimes(1);
  });

  it('should only delete message when ledger acquire does not acquire', async () => {
    const sqs = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const ledgerService = {
      hashPayload: jest.fn().mockReturnValue('payload-hash'),
      acquire: jest.fn().mockResolvedValue({ acquired: false, attemptCount: 0 }),
      markNonRetryableFailed: jest.fn().mockResolvedValue(undefined),
    };

    await markMalformedMessageAsNonRetryable(
      {
        message: {
          MessageId: 'm-2',
          Body: 'not-json',
          ReceiptHandle: 'rh-2',
        } as any,
        module: TradeExecutionModule.RISK,
        messageTtlMs: 60_000,
        sqs: sqs as any,
        queueUrl: 'queue-url',
        ledgerService: ledgerService as any,
        resolveUserId: () => 'unknown',
      },
      'parse failed',
    );

    expect(ledgerService.markNonRetryableFailed).not.toHaveBeenCalled();
    expect(sqs.send).toHaveBeenCalledTimes(1);
  });
});
