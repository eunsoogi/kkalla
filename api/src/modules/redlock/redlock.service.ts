import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';
import { I18nService } from 'nestjs-i18n';
import Redlock, { Lock } from 'redlock';

import { REDLOCK_OPTIONS } from './redlock.constants';
import { RedlockExecutionContext } from './redlock.interface';
import { RedlockLockStatus } from './redlock.interface';
import { RedlockModuleOptions } from './redlock.interface';

@Injectable()
export class RedlockService implements OnModuleDestroy {
  private readonly redlock: Redlock;
  private readonly logger = new Logger(RedlockService.name);
  private readonly redisClient: Redis;
  private readonly LOCK_EXTENSION_MIN_INTERVAL_MS = 1_000;
  private readonly LOCK_EXTENSION_INTERVAL_FACTOR = 0.5;

  constructor(
    @Inject(REDLOCK_OPTIONS)
    private readonly options: RedlockModuleOptions,
    private readonly i18n: I18nService,
  ) {
    this.redisClient = new Redis({
      host: this.options.redis.host,
      port: this.options.redis.port,
      password: this.options.redis.password,
    });

    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 0,
      retryJitter: 50,
    });
  }

  /**
   * Runs acquire lock in the distributed lock workflow.
   * @param lockKey - Lock data used for concurrency control.
   * @param duration - Input value for duration.
   * @returns Asynchronous result produced by the distributed lock flow.
   */
  private async acquireLock(lockKey: string, duration: number): Promise<Lock | null> {
    try {
      return await this.redlock.acquire([lockKey], duration);
    } catch {
      // 락 획득 실패 시 조용히 null 반환
      return null;
    }
  }

  /**
   * Handles with lock in the distributed lock workflow.
   * @param resourceName - Input value for resource name.
   * @param duration - Input value for duration.
   * @param callback - Callback invoked within the workflow.
   * @returns Asynchronous result produced by the distributed lock flow.
   */
  public async withLock<T>(
    resourceName: string,
    duration: number,
    callback: (context: RedlockExecutionContext) => Promise<T>,
  ): Promise<T | undefined> {
    const lockKey = this.getLockKey(resourceName);
    let activeLock: Lock | null = null;
    let extensionTimer: NodeJS.Timeout | null = null;
    let extensionInFlight: Promise<void> | null = null;
    let extensionError: unknown = null;
    const extensionAbortController = new AbortController();

    const toLockExtensionError = () => {
      const details = extensionError instanceof Error ? extensionError.message : String(extensionError);
      const message = `Redlock extension failed for ${resourceName}${extensionError ? `: ${details}` : ''}`;
      const error = new Error(message);
      error.name = 'RedlockExtensionError';
      return error;
    };

    const executionContext: RedlockExecutionContext = {
      signal: extensionAbortController.signal,
      assertLockOrThrow: () => {
        // Long-running callbacks can poll this to stop immediately after lock extension failure.
        if (extensionAbortController.signal.aborted) {
          throw toLockExtensionError();
        }
      },
    };

    try {
      activeLock = await this.acquireLock(lockKey, duration);

      // Lock 획득 실패 시 함수 실행 건너뜀
      if (!activeLock) {
        this.logger.debug(this.i18n.t('logging.redlock.lock.not_acquired', { args: { resourceName } }));
        return undefined;
      }

      // Refresh at half TTL (bounded by a minimum interval) to keep lock ownership alive.
      const extensionIntervalMs = Math.max(
        this.LOCK_EXTENSION_MIN_INTERVAL_MS,
        Math.floor(duration * this.LOCK_EXTENSION_INTERVAL_FACTOR),
      );
      extensionTimer = setInterval(() => {
        if (!activeLock || extensionInFlight || extensionError) {
          return;
        }

        extensionInFlight = activeLock
          .extend(duration)
          .then((extendedLock) => {
            activeLock = extendedLock;
          })
          .catch((error) => {
            extensionError = error;
            extensionAbortController.abort();
            this.logger.error(this.i18n.t('logging.redlock.lock.extend_error', { args: { resourceName } }), error);
          })
          .finally(() => {
            extensionInFlight = null;
          });
      }, extensionIntervalMs);
      extensionTimer.unref?.();

      // Lock을 얻으면 함수 실행
      this.logger.debug(this.i18n.t('logging.redlock.lock.acquired', { args: { resourceName } }));
      // Race callback against extension failure so work aborts if lock safety is lost.
      const lockExtensionFailurePromise = new Promise<never>((_, reject) => {
        if (extensionAbortController.signal.aborted) {
          reject(toLockExtensionError());
          return;
        }

        extensionAbortController.signal.addEventListener(
          'abort',
          () => {
            reject(toLockExtensionError());
          },
          { once: true },
        );
      });

      const callbackPromise = callback(executionContext);
      void callbackPromise.catch(() => undefined);

      return await Promise.race([callbackPromise, lockExtensionFailurePromise]);
    } finally {
      if (extensionTimer) {
        clearInterval(extensionTimer);
      }

      if (extensionInFlight) {
        await extensionInFlight.catch(() => undefined);
      }

      if (activeLock) {
        try {
          await activeLock.release();
          this.logger.debug(this.i18n.t('logging.redlock.lock.released', { args: { resourceName } }));
        } catch (error) {
          this.logger.error(this.i18n.t('logging.redlock.lock.release_error', { args: { resourceName } }), error);
        }
      }
    }
  }

  /**
   * Runs with lock in the distributed lock workflow.
   * @param resourceName - Input value for resource name.
   * @param duration - Input value for duration.
   * @param callback - Callback invoked within the workflow.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  public async startWithLock(resourceName: string, duration: number, callback: () => Promise<void>): Promise<boolean> {
    const lockKey = this.getLockKey(resourceName);
    const lock = await this.acquireLock(lockKey, duration);

    if (!lock) {
      this.logger.debug(this.i18n.t('logging.redlock.lock.not_acquired', { args: { resourceName } }));
      return false;
    }

    this.logger.debug(this.i18n.t('logging.redlock.lock.acquired', { args: { resourceName } }));

    void (async () => {
      try {
        await callback();
      } catch (error) {
        this.logger.error(this.i18n.t('logging.redlock.lock.background_task_error', { args: { resourceName } }), error);
      } finally {
        try {
          await lock.release();
          this.logger.debug(this.i18n.t('logging.redlock.lock.released', { args: { resourceName } }));
        } catch (error) {
          this.logger.error(this.i18n.t('logging.redlock.lock.release_error', { args: { resourceName } }), error);
        }
      }
    })();

    return true;
  }

  /**
   * Runs with locks in the distributed lock workflow.
   * @param resourceNames - Input value for resource names.
   * @param duration - Input value for duration.
   * @param callback - Callback invoked within the workflow.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  public async startWithLocks(
    resourceNames: string[],
    duration: number,
    callback: () => Promise<void>,
  ): Promise<boolean> {
    const uniqueResourceNames = [...new Set(resourceNames)].filter((name) => name.length > 0);
    if (uniqueResourceNames.length < 1) {
      return false;
    }

    const acquiredLocks: Array<{ resourceName: string; lock: Lock }> = [];
    const logResourceName = uniqueResourceNames.join(',');

    // Acquire sequentially; if one fails, release already-acquired locks immediately.
    for (const resourceName of uniqueResourceNames) {
      const lockKey = this.getLockKey(resourceName);
      const lock = await this.acquireLock(lockKey, duration);

      if (!lock) {
        this.logger.debug(this.i18n.t('logging.redlock.lock.not_acquired', { args: { resourceName } }));
        await this.releaseStartLocks(acquiredLocks);
        return false;
      }

      acquiredLocks.push({ resourceName, lock });
      this.logger.debug(this.i18n.t('logging.redlock.lock.acquired', { args: { resourceName } }));
    }

    void (async () => {
      try {
        await callback();
      } catch (error) {
        this.logger.error(
          this.i18n.t('logging.redlock.lock.background_task_error', { args: { resourceName: logResourceName } }),
          error,
        );
      } finally {
        await this.releaseStartLocks(acquiredLocks);
      }
    })();

    return true;
  }

  /**
   * Retrieves lock status for the distributed lock flow.
   * @param resourceName - Input value for resource name.
   * @returns Asynchronous result produced by the distributed lock flow.
   */
  public async getLockStatus(resourceName: string): Promise<RedlockLockStatus> {
    const lockKey = this.getLockKey(resourceName);
    const ttlMs = await this.redisClient.pttl(lockKey);

    // Redis pttl: -2 missing key, -1 no expire, >=0 remaining milliseconds.
    if (ttlMs === -2) {
      return {
        locked: false,
        ttlMs: null,
      };
    }

    if (ttlMs === -1) {
      return {
        locked: true,
        ttlMs: null,
      };
    }

    return {
      locked: ttlMs >= 0,
      ttlMs,
    };
  }

  /**
   * Handles force release lock in the distributed lock workflow.
   * @param resourceName - Input value for resource name.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  public async forceReleaseLock(resourceName: string): Promise<boolean> {
    const lockKey = this.getLockKey(resourceName);
    const deleted = await this.redisClient.del(lockKey);
    return deleted > 0;
  }

  /**
   * Runs release start locks in the distributed lock workflow.
   * @param acquiredLocks - Lock data used for concurrency control.
   */
  private async releaseStartLocks(acquiredLocks: Array<{ resourceName: string; lock: Lock }>): Promise<void> {
    for (const acquiredLock of [...acquiredLocks].reverse()) {
      try {
        await acquiredLock.lock.release();
        this.logger.debug(
          this.i18n.t('logging.redlock.lock.released', { args: { resourceName: acquiredLock.resourceName } }),
        );
      } catch (error) {
        this.logger.error(
          this.i18n.t('logging.redlock.lock.release_error', { args: { resourceName: acquiredLock.resourceName } }),
          error,
        );
      }
    }
  }

  /**
   * Retrieves lock key for the distributed lock flow.
   * @param resource - Input value for resource.
   * @returns Formatted string output for the operation.
   */
  private getLockKey(resource: string): string {
    const namespace = process.env.NODE_ENV || 'development';
    return `lock:${namespace}:${resource}`;
  }

  /**
   * Handles on module destroy in the distributed lock workflow.
   * @returns Result produced by the distributed lock flow.
   */
  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
