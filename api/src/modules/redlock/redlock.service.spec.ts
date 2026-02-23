import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';
import { Lock } from 'redlock';

import { REDLOCK_OPTIONS } from './redlock.constants';
import { RedlockService } from './redlock.service';

const redisClientMock = {
  pttl: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

const acquireMock = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    pttl: redisClientMock.pttl,
    del: redisClientMock.del,
    quit: redisClientMock.quit,
  })),
);

jest.mock('redlock', () =>
  jest.fn().mockImplementation(() => ({
    acquire: acquireMock,
  })),
);

describe('RedlockService', () => {
  let service: RedlockService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedlockService,
        {
          provide: REDLOCK_OPTIONS,
          useValue: {
            redis: {
              host: 'localhost',
              port: 6379,
            },
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn((key: string) => key),
          },
        },
      ],
    }).compile();

    service = module.get<RedlockService>(RedlockService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should abort callback execution when lock extension fails', async () => {
    const lock = {
      extend: jest.fn().mockRejectedValue(new Error('extend failed')),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as Lock;
    acquireMock.mockResolvedValue(lock);

    const promise = service.withLock('trade:user:1', 1_000, async ({ assertLockOrThrow }) => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      assertLockOrThrow();
      return true;
    });

    await jest.advanceTimersByTimeAsync(1_000);
    await expect(promise).rejects.toThrow('Redlock extension failed');
    await jest.advanceTimersByTimeAsync(5_000);

    expect(lock.extend).toHaveBeenCalledTimes(1);
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('should resolve callback result when no extension error occurs', async () => {
    const lock = {
      extend: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as Lock;
    acquireMock.mockResolvedValue(lock);

    const result = await service.withLock('trade:user:2', 1_000, async ({ assertLockOrThrow }) => {
      assertLockOrThrow();
      return 'done';
    });

    expect(result).toBe('done');
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('should start callback only when all startWithLocks resources are acquired', async () => {
    const firstLock = {
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as Lock;
    const secondLock = {
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as Lock;
    acquireMock.mockResolvedValueOnce(firstLock).mockResolvedValueOnce(secondLock);

    const callback = jest.fn().mockResolvedValue(undefined);
    const started = await service.startWithLocks(['resource:new', 'resource:legacy'], 1_000, callback);
    await Promise.resolve();

    expect(started).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(secondLock.release).toHaveBeenCalledTimes(1);
    expect(firstLock.release).toHaveBeenCalledTimes(1);
  });

  it('should release already acquired locks when one of startWithLocks resources is not acquired', async () => {
    const firstLock = {
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as Lock;
    acquireMock.mockResolvedValueOnce(firstLock).mockResolvedValueOnce(null);

    const callback = jest.fn().mockResolvedValue(undefined);
    const started = await service.startWithLocks(['resource:new', 'resource:legacy'], 1_000, callback);

    expect(started).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    expect(firstLock.release).toHaveBeenCalledTimes(1);
  });
});
