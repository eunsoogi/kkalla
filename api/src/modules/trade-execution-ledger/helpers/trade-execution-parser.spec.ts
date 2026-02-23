import { TradeExecutionModule } from '@/modules/trade-execution-ledger/trade-execution-ledger.enum';

import { parseTradeExecutionMessage } from './trade-execution-parser';

describe('trade-execution-parser utils', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should parse v2 allocation message with allocation mode', () => {
    const parseInference = jest.fn().mockReturnValue({ id: 'i-1' });
    const parseAllocationMode = jest.fn().mockReturnValue('existing');
    const payload = {
      version: 2,
      module: TradeExecutionModule.ALLOCATION,
      runId: 'run-1',
      messageKey: 'key-1',
      userId: 'user-1',
      generatedAt: new Date('2026-02-23T00:00:00.000Z').toISOString(),
      expiresAt: new Date('2026-02-23T00:30:00.000Z').toISOString(),
      allocationMode: 'existing',
      inferences: [{}],
    };

    const result = parseTradeExecutionMessage({
      module: TradeExecutionModule.ALLOCATION,
      moduleLabel: 'allocation',
      queueMessageVersion: 2,
      messageBody: JSON.stringify(payload),
      parseInference,
      parseAllocationMode,
    });

    expect(result.module).toBe(TradeExecutionModule.ALLOCATION);
    expect(result.allocationMode).toBe('existing');
    expect(parseInference).toHaveBeenCalledTimes(1);
    expect(parseAllocationMode).toHaveBeenCalledWith('existing');
  });

  it('should parse legacy module aliases during rollout', () => {
    const now = new Date('2026-02-23T00:00:00.000Z').toISOString();
    const expiresAt = new Date('2026-02-23T00:30:00.000Z').toISOString();

    const allocationMessage = parseTradeExecutionMessage({
      module: TradeExecutionModule.ALLOCATION,
      moduleLabel: 'allocation',
      queueMessageVersion: 2,
      messageBody: JSON.stringify({
        version: 2,
        module: 'rebalance',
        runId: 'run-1',
        messageKey: 'key-1',
        userId: 'user-1',
        generatedAt: now,
        expiresAt,
        allocationMode: 'existing',
        inferences: [{ id: 'i-1' }],
      }),
      acceptedModuleAliases: ['rebalance'],
      parseInference: (inference) => inference as any,
      parseAllocationMode: (value) => value as any,
    });

    expect(allocationMessage.module).toBe(TradeExecutionModule.ALLOCATION);

    const riskMessage = parseTradeExecutionMessage({
      module: TradeExecutionModule.RISK,
      moduleLabel: 'risk',
      queueMessageVersion: 2,
      messageBody: JSON.stringify({
        version: 2,
        module: 'volatility',
        runId: 'run-2',
        messageKey: 'key-2',
        userId: 'user-2',
        generatedAt: now,
        expiresAt,
        inferences: [{ id: 'i-2' }],
      }),
      acceptedModuleAliases: ['volatility'],
      parseInference: (inference) => inference as any,
    });

    expect(riskMessage.module).toBe(TradeExecutionModule.RISK);
  });

  it('should throw when module or version is unsupported', () => {
    expect(() =>
      parseTradeExecutionMessage({
        module: TradeExecutionModule.ALLOCATION,
        moduleLabel: 'allocation',
        queueMessageVersion: 2,
        messageBody: JSON.stringify({ version: 99 }),
        parseInference: () => ({ id: 'x' }) as any,
      }),
    ).toThrow('Unsupported allocation message version');

    expect(() =>
      parseTradeExecutionMessage({
        module: TradeExecutionModule.ALLOCATION,
        moduleLabel: 'allocation',
        queueMessageVersion: 2,
        messageBody: JSON.stringify({
          version: 2,
          module: TradeExecutionModule.RISK,
          runId: 'run-1',
          messageKey: 'run-1:user-1',
          userId: 'u',
          generatedAt: new Date('2026-02-23T00:00:00.000Z').toISOString(),
          expiresAt: new Date('2026-02-23T00:30:00.000Z').toISOString(),
          inferences: [],
        }),
        parseInference: () => ({ id: 'x' }) as any,
      }),
    ).toThrow('Unsupported allocation message module');
  });
});
