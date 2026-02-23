import { Injectable } from '@nestjs/common';

import { In } from 'typeorm';

import { RecommendationItem } from '../allocation-core/allocation-core.types';
import { User } from '../user/entities/user.entity';
import { HoldingLedger } from './entities/holding-ledger.entity';
import { HoldingLedgerItem, HoldingLedgerRemoveItem } from './holding-ledger.interface';

@Injectable()
export class HoldingLedgerService {
  /**
   * 현재 자산 배분 조회
   *
   * - 저장된 자산 배분 종목 목록을 조회합니다.
   * - 인덱스 순서대로 정렬하여 반환합니다.
   *
   * @returns 현재 자산 배분 종목 목록
   */
  public async fetchHoldings(): Promise<RecommendationItem[]> {
    const items = await HoldingLedger.find({
      relations: {
        user: true,
      },
      order: {
        index: 'ASC',
      },
    });

    return this.toRecommendationItems(items);
  }

  public async fetchHoldingsByUser(user: User): Promise<RecommendationItem[]> {
    const items = await HoldingLedger.find({
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

  public async fetchHoldingsByUsers(users: User[]): Promise<RecommendationItem[]> {
    if (users.length < 1) {
      return [];
    }

    const userIds = users.map((user) => user.id);
    const items = await HoldingLedger.find({
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
   * 자산 배분 저장
   *
   * - 기존 자산 배분를 모두 삭제하고 새로운 자산 배분를 저장합니다.
   * - 전체 자산 배분를 교체하는 방식으로 동작합니다.
   *
   * @param items 저장할 자산 배분 종목 목록
   * @returns 저장된 자산 배분 엔티티 목록
   */
  public async replaceHoldingsForUser(user: User, items: HoldingLedgerItem[]): Promise<HoldingLedger[]> {
    await HoldingLedger.createQueryBuilder().delete().where('user_id = :userId', { userId: user.id }).execute();

    if (items.length < 1) {
      return [];
    }

    return HoldingLedger.save(
      items.map((item) =>
        HoldingLedger.create({
          user,
          symbol: item.symbol,
          category: item.category,
          index: item.index,
        }),
      ),
    );
  }

  /**
   * 자산 배분에서 특정 종목들 삭제
   *
   * - 전량 매도된 종목 등을 자산 배분에서 제거합니다.
   * - 삭제할 종목이 없으면 아무 작업도 수행하지 않습니다.
   * - 심볼과 카테고리를 함께 고려하여 정확한 종목만 삭제합니다.
   *
   * @param items 삭제할 종목 목록 (심볼과 카테고리)
   */
  public async removeHoldingsForUser(user: User, items: HoldingLedgerRemoveItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    // 심볼과 카테고리를 함께 고려하여 삭제
    // 각 항목에 대해 개별적으로 삭제 (TypeORM의 복잡한 OR 조건 대신)
    await Promise.all(
      items.map((item) =>
        HoldingLedger.createQueryBuilder()
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

  private toRecommendationItems(items: HoldingLedger[]): RecommendationItem[] {
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
