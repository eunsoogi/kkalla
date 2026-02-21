import { Injectable } from '@nestjs/common';

import { In } from 'typeorm';

import { RecommendationItem } from '../rebalance/rebalance.interface';
import { User } from '../user/entities/user.entity';
import { History } from './entities/history.entity';
import { HistoryItem, HistoryRemoveItem } from './history.interface';

@Injectable()
export class HistoryService {
  /**
   * 현재 포트폴리오 조회
   *
   * - 저장된 포트폴리오 종목 목록을 조회합니다.
   * - 인덱스 순서대로 정렬하여 반환합니다.
   *
   * @returns 현재 포트폴리오 종목 목록
   */
  public async fetchHistory(): Promise<RecommendationItem[]> {
    const items = await History.find({
      relations: {
        user: true,
      },
      order: {
        index: 'ASC',
      },
    });

    return this.toRecommendationItems(items);
  }

  public async fetchHistoryByUser(user: User): Promise<RecommendationItem[]> {
    const items = await History.find({
      where: {
        user: {
          id: user.id,
        },
      },
      order: {
        index: 'ASC',
      },
    });

    return items.map((item) => ({
      symbol: item.symbol,
      category: item.category,
      hasStock: true,
    }));
  }

  public async fetchHistoryByUsers(users: User[]): Promise<RecommendationItem[]> {
    if (users.length < 1) {
      return [];
    }

    const userIds = users.map((user) => user.id);
    const items = await History.find({
      where: {
        user: {
          id: In(userIds),
        },
      },
      relations: {
        user: true,
      },
      order: {
        index: 'ASC',
      },
    });

    return this.toRecommendationItems(items);
  }

  /**
   * 포트폴리오 저장
   *
   * - 기존 포트폴리오를 모두 삭제하고 새로운 포트폴리오를 저장합니다.
   * - 전체 포트폴리오를 교체하는 방식으로 동작합니다.
   *
   * @param items 저장할 포트폴리오 종목 목록
   * @returns 저장된 포트폴리오 엔티티 목록
   */
  public async saveHistoryForUser(user: User, items: HistoryItem[]): Promise<History[]> {
    await History.createQueryBuilder().delete().where('user_id = :userId', { userId: user.id }).execute();

    if (items.length < 1) {
      return [];
    }

    return History.save(
      items.map((item) =>
        History.create({
          user,
          symbol: item.symbol,
          category: item.category,
          index: item.index,
        }),
      ),
    );
  }

  /**
   * 포트폴리오에서 특정 종목들 삭제
   *
   * - 전량 매도된 종목 등을 포트폴리오에서 제거합니다.
   * - 삭제할 종목이 없으면 아무 작업도 수행하지 않습니다.
   * - 심볼과 카테고리를 함께 고려하여 정확한 종목만 삭제합니다.
   *
   * @param items 삭제할 종목 목록 (심볼과 카테고리)
   */
  public async removeHistoryForUser(user: User, items: HistoryRemoveItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    // 심볼과 카테고리를 함께 고려하여 삭제
    // 각 항목에 대해 개별적으로 삭제 (TypeORM의 복잡한 OR 조건 대신)
    await Promise.all(
      items.map((item) =>
        History.createQueryBuilder()
          .delete()
          .where('user_id = :userId AND symbol = :symbol AND category = :category', {
            userId: user.id,
            symbol: item.symbol,
            category: item.category,
          })
          .execute(),
      ),
    );
  }

  private toRecommendationItems(items: History[]): RecommendationItem[] {
    const deduped = new Map<string, RecommendationItem>();

    items.forEach((item) => {
      const key = `${item.symbol}:${item.category}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          symbol: item.symbol,
          category: item.category,
          hasStock: true,
        });
      }
    });

    return Array.from(deduped.values());
  }
}
