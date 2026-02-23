import { executeTradesSequentiallyWithRequests } from './trade-execution-runner';

describe('trade-execution-runner utils', () => {
  it('should execute requests sequentially with lock guard checks', async () => {
    const guard = jest.fn();
    const executeTrade = jest.fn(async (request: { id: number }) => `trade-${request.id}`);

    const result = await executeTradesSequentiallyWithRequests([{ id: 1 }, { id: 2 }], executeTrade, guard);

    expect(executeTrade).toHaveBeenNthCalledWith(1, { id: 1 });
    expect(executeTrade).toHaveBeenNthCalledWith(2, { id: 2 });
    expect(guard).toHaveBeenCalledTimes(4);
    expect(result).toEqual([
      { request: { id: 1 }, trade: 'trade-1' },
      { request: { id: 2 }, trade: 'trade-2' },
    ]);
  });

  it('should execute without guard when lock guard is omitted', async () => {
    const executeTrade = jest.fn(async (request: { id: number }) => request.id);
    const result = await executeTradesSequentiallyWithRequests([{ id: 1 }], executeTrade);
    expect(result).toEqual([{ request: { id: 1 }, trade: 1 }]);
  });
});
