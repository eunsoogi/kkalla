import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';
import { I18nService } from 'nestjs-i18n';
import Redlock, { Lock } from 'redlock';

import { REDLOCK_OPTIONS } from './redlock.constants';
import { RedlockModuleOptions } from './redlock.interface';

@Injectable()
export class RedlockService implements OnModuleDestroy {
  private readonly redlock: Redlock;
  private readonly logger = new Logger(RedlockService.name);
  private readonly redisClient: Redis;

  constructor(
    @Inject(REDLOCK_OPTIONS)
    private readonly options: RedlockModuleOptions,
    private readonly i18n: I18nService,
  ) {
    this.redisClient = new Redis({
      host: options.redis.host,
      port: options.redis.port,
      password: options.redis.password,
    });

    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 0,
      retryJitter: 50,
    });
  }

  private async acquireLock(lockKey: string, duration: number): Promise<Lock | null> {
    try {
      return await this.redlock.acquire([lockKey], duration);
    } catch {
      // 락 획득 실패 시 조용히 null 반환
      return null;
    }
  }

  public async withLock<T>(resourceName: string, duration: number, callback: () => Promise<T>): Promise<T | undefined> {
    const lockKey = this.getLockKey(resourceName);
    let lock: Lock | null = null;

    try {
      lock = await this.acquireLock(lockKey, duration);

      // Lock 획득 실패 시 함수 실행 건너뜀
      if (!lock) {
        this.logger.debug(
          await this.i18n.translate('redlock.lock.not_acquired', {
            args: { resourceName },
          }),
        );
        return undefined;
      }

      // Lock을 얻으면 함수 실행
      this.logger.debug(
        await this.i18n.translate('redlock.lock.acquired', {
          args: { resourceName },
        }),
      );

      return await callback();
    } finally {
      if (lock) {
        try {
          await lock.release();

          this.logger.debug(
            await this.i18n.translate('redlock.lock.released', {
              args: { resourceName },
            }),
          );
        } catch (error) {
          this.logger.error(
            await this.i18n.translate('redlock.lock.release_error', {
              args: { resourceName },
            }),
            error,
          );
        }
      }
    }
  }

  private getLockKey(resource: string): string {
    const namespace = process.env.NODE_ENV || 'development';
    return `lock:${namespace}:${resource}`;
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
