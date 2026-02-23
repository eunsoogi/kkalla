import { REDLOCK_SERVICE } from '../redlock.constants';
import { WithRedlock } from './redlock.decorator';

describe('WithRedlock', () => {
  const createRedlockServiceMock = () => ({
    withLock: jest.fn(
      async (
        _resourceName: string,
        _duration: number,
        callback: (context: { signal: AbortSignal; assertLockOrThrow: () => void }) => Promise<unknown>,
      ) =>
        callback({
          signal: new AbortController().signal,
          assertLockOrThrow: jest.fn(),
        }),
    ),
  });

  it('should use class and method name as default resource', async () => {
    const redlockService = createRedlockServiceMock();

    class SampleService {
      [REDLOCK_SERVICE] = redlockService;

      /**
       * Runs workflow logic in the distributed lock workflow.
       * @param payload - Input value for payload.
       * @returns Formatted string output for the operation.
       */
      @WithRedlock({ duration: 1_000 })
      public async execute(payload: string): Promise<string> {
        return `done:${payload}`;
      }
    }

    const service = new SampleService();
    const result = await service.execute('test');

    expect(result).toBe('done:test');
    expect(redlockService.withLock).toHaveBeenCalledTimes(1);
    expect(redlockService.withLock).toHaveBeenCalledWith('SampleService:execute', 1_000, expect.any(Function));
  });

  it('should acquire compatible resource locks in sequence', async () => {
    const redlockService = createRedlockServiceMock();
    const executeSpy = jest.fn().mockResolvedValue('ok');

    class SampleService {
      [REDLOCK_SERVICE] = redlockService;

      /**
       * Runs workflow logic in the distributed lock workflow.
       * @returns Formatted string output for the operation.
       */
      @WithRedlock({
        resourceName: 'AllocationService:executeAllocationRecommendationNew',
        compatibleResourceNames: ['RebalanceService:executeBalanceRecommendationNew'],
        duration: 3_600_000,
      })
      public async execute(): Promise<string> {
        return executeSpy();
      }
    }

    const service = new SampleService();
    const result = await service.execute();

    expect(result).toBe('ok');
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(redlockService.withLock).toHaveBeenCalledTimes(2);
    expect(redlockService.withLock.mock.calls.map(([resourceName]) => resourceName)).toEqual([
      'AllocationService:executeAllocationRecommendationNew',
      'RebalanceService:executeBalanceRecommendationNew',
    ]);
  });

  it('should skip callback when compatible lock is not acquired', async () => {
    const redlockService = createRedlockServiceMock();
    const executeSpy = jest.fn().mockResolvedValue('ok');
    redlockService.withLock.mockImplementation(
      async (
        resourceName: string,
        _duration: number,
        callback: (context: { signal: AbortSignal; assertLockOrThrow: () => void }) => Promise<unknown>,
      ) => {
        if (resourceName === 'RebalanceService:executeBalanceRecommendationNew') {
          return undefined;
        }

        return callback({
          signal: new AbortController().signal,
          assertLockOrThrow: jest.fn(),
        });
      },
    );

    class SampleService {
      [REDLOCK_SERVICE] = redlockService;

      /**
       * Runs workflow logic in the distributed lock workflow.
       * @returns Formatted string output for the operation.
       */
      @WithRedlock({
        resourceName: 'AllocationService:executeAllocationRecommendationNew',
        compatibleResourceNames: ['RebalanceService:executeBalanceRecommendationNew'],
        duration: 3_600_000,
      })
      public async execute(): Promise<string> {
        return executeSpy();
      }
    }

    const service = new SampleService();
    const result = await service.execute();

    expect(result).toBeUndefined();
    expect(executeSpy).not.toHaveBeenCalled();
  });
});
