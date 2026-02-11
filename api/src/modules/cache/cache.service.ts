import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';
import { I18nService } from 'nestjs-i18n';

/**
 * 간단한 Redis 기반 캐시 서비스.
 *
 * - JSON 직렬화/역직렬화로 임의의 값을 저장/조회
 * - TTL(초) 기반 만료 지원
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly i18n: I18nService) {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    });
  }

  /**
   * 캐시에서 값 조회
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch (error) {
      // Redis 장애 및 JSON 파싱 실패 시 캐시를 무시하고 통과
      this.logger.warn(this.i18n.t('logging.cache.get_failed', { args: { key } }), error as Error);
      return null;
    }
  }

  /**
   * 캐시에 값 저장 (TTL 초 단위)
   */
  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
    } catch (error) {
      // 캐시 저장 실패는 비치명적으로 처리 (원래 로직은 이미 실행 완료된 상태여야 함)
      this.logger.warn(this.i18n.t('logging.cache.set_failed', { args: { key } }), error as Error);
    }
  }

  /**
   * 캐시 키 삭제
   */
  public async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      // 삭제 실패 역시 치명적이지 않으므로 무시
      this.logger.warn(this.i18n.t('logging.cache.del_failed', { args: { key } }), error as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      // 종료 시점 에러도 무시
      this.logger.warn(this.i18n.t('logging.cache.quit_failed'), error as Error);
    }
  }
}
