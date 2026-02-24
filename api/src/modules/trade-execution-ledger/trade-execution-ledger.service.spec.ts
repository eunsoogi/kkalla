import { normalizeIdentifierToUlid } from '@/utils/id';

import { TradeExecutionLedger } from './entities/trade-execution-ledger.entity';
import { TradeExecutionLedgerStatus } from './trade-execution-ledger.enum';
import { TradeExecutionLedgerService } from './trade-execution-ledger.service';

describe('TradeExecutionLedgerService', () => {
  let service: TradeExecutionLedgerService;

  beforeEach(() => {
    service = new TradeExecutionLedgerService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should preserve processing status on duplicate insert race', async () => {
    const input = {
      module: 'allocation',
      messageKey: 'run-1:user-1',
      userId: 'user-1',
      payloadHash: 'hash-1',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    const processingRow = {
      status: TradeExecutionLedgerStatus.PROCESSING,
      save: jest.fn(),
    } as unknown as TradeExecutionLedger;

    jest.spyOn(TradeExecutionLedger, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(processingRow);
    jest.spyOn(TradeExecutionLedger.prototype, 'save').mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });
    const markStatusSpy = jest.spyOn(service as any, 'markStatus');

    const result = await service.acquire(input);

    expect(result).toEqual({
      acquired: false,
      status: TradeExecutionLedgerStatus.PROCESSING,
    });
    expect(markStatusSpy).not.toHaveBeenCalled();
    expect((processingRow as any).save).not.toHaveBeenCalled();
  });

  it('should keep duplicate race retriable when row cannot be re-read', async () => {
    const input = {
      module: 'allocation',
      messageKey: 'run-2:user-1',
      userId: 'user-1',
      payloadHash: 'hash-2',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    jest.spyOn(TradeExecutionLedger, 'findOne').mockResolvedValue(null);
    jest.spyOn(TradeExecutionLedger.prototype, 'save').mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });
    const markStatusSpy = jest.spyOn(service as any, 'markStatus');

    const result = await service.acquire(input);

    expect(result).toEqual({
      acquired: false,
      status: TradeExecutionLedgerStatus.PROCESSING,
    });
    expect(markStatusSpy).not.toHaveBeenCalled();
  });

  it('should guard stale processing reacquire with startedAt snapshot', async () => {
    const input = {
      module: 'allocation',
      messageKey: 'run-3:user-1',
      userId: 'user-1',
      payloadHash: 'hash-3',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    const staleStartedAt = new Date(Date.now() - service.getProcessingStaleMs() - 1_000);
    const staleProcessingRow = {
      id: 'ledger-1',
      module: input.module,
      messageKey: input.messageKey,
      userId: input.userId,
      status: TradeExecutionLedgerStatus.PROCESSING,
      attemptCount: 2,
      payloadHash: 'old-hash',
      generatedAt: input.generatedAt,
      expiresAt: input.expiresAt,
      startedAt: staleStartedAt,
      finishedAt: null,
      error: null,
      save: jest.fn(),
    } as unknown as TradeExecutionLedger;

    jest.spyOn(TradeExecutionLedger, 'findOne').mockResolvedValueOnce(staleProcessingRow);
    const updateSpy = jest.spyOn(TradeExecutionLedger, 'update').mockResolvedValueOnce({ affected: 0 } as any);

    const result = await service.acquire(input);

    expect(result).toEqual({
      acquired: false,
      status: TradeExecutionLedgerStatus.PROCESSING,
    });
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: staleProcessingRow.id,
        status: TradeExecutionLedgerStatus.PROCESSING,
        attemptCount: staleProcessingRow.attemptCount,
        startedAt: staleStartedAt,
      }),
      expect.any(Object),
    );
  });

  it('should preserve succeeded status for duplicate deliveries', async () => {
    const input = {
      module: 'allocation',
      messageKey: 'run-4:user-1',
      userId: 'user-1',
      payloadHash: 'hash-4',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    const succeededRow = {
      status: TradeExecutionLedgerStatus.SUCCEEDED,
      save: jest.fn(),
    } as unknown as TradeExecutionLedger;

    jest.spyOn(TradeExecutionLedger, 'findOne').mockResolvedValueOnce(succeededRow);
    const markStatusSpy = jest.spyOn(service as any, 'markStatus');

    const result = await service.acquire(input);

    expect(result).toEqual({
      acquired: false,
      status: TradeExecutionLedgerStatus.SUCCEEDED,
    });
    expect(markStatusSpy).not.toHaveBeenCalled();
    expect((succeededRow as any).save).not.toHaveBeenCalled();
  });

  it('should return attemptCount when a row is newly acquired', async () => {
    const input = {
      module: 'allocation',
      messageKey: 'run-5:user-1',
      userId: 'user-1',
      payloadHash: 'hash-5',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    jest.spyOn(TradeExecutionLedger, 'findOne').mockResolvedValueOnce(null);
    jest.spyOn(TradeExecutionLedger.prototype, 'save').mockResolvedValueOnce(undefined as never);

    const result = await service.acquire(input);

    expect(result).toEqual({
      acquired: true,
      status: TradeExecutionLedgerStatus.PROCESSING,
      attemptCount: 1,
    });
  });

  it('should normalize non-ulid userId before persisting ledger row', async () => {
    const input = {
      module: 'allocation',
      messageKey: 'run-6:user-1',
      userId: '3f3af1ad-2c1a-4f6c-af4a-4af5a81d53a7',
      payloadHash: 'hash-6',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    let savedUserId = '';
    jest.spyOn(TradeExecutionLedger, 'findOne').mockResolvedValueOnce(null);
    jest.spyOn(TradeExecutionLedger.prototype, 'save').mockImplementationOnce(async function saveMock(
      this: TradeExecutionLedger,
    ) {
      savedUserId = this.userId;
      return this as TradeExecutionLedger;
    });

    await service.acquire(input);

    expect(savedUserId).toBe(normalizeIdentifierToUlid(input.userId));
  });

  it('should guard terminal updates using processing attemptCount', async () => {
    const updateSpy = jest.spyOn(TradeExecutionLedger, 'update').mockResolvedValueOnce({ affected: 1 } as any);

    await service.markSucceeded({
      module: 'allocation',
      messageKey: 'run-6:user-1',
      userId: 'user-1',
      attemptCount: 2,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      {
        module: 'allocation',
        messageKey: 'run-6:user-1',
        userId: normalizeIdentifierToUlid('user-1'),
        status: TradeExecutionLedgerStatus.PROCESSING,
        attemptCount: 2,
      },
      expect.objectContaining({
        status: TradeExecutionLedgerStatus.SUCCEEDED,
      }),
    );
  });
});
