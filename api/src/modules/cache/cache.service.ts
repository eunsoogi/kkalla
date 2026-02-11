import { Injectable, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';

/**
 * 간단한 Redis 기반 캐시 서비스.
 *
 * - JSON 직렬화/역직렬화로 임의의 값을 저장/조회
 * - TTL(초) 기반 만료 지원
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
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
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      // 파싱 실패 시 캐시 무시
      return null;
    }
  }

  /**
   * 캐시에 값 저장 (TTL 초 단위)
   */
  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  /**
   * 캐시 키 삭제
   */
  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
