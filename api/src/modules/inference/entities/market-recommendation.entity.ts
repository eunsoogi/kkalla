import {
  BaseEntity,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

export interface MarketRecommendationFilter {
  ticker?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

@Entity()
export class MarketRecommendation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  weight: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  confidence: number;

  @Column({ type: 'varchar', length: 50 })
  batchId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * 최신 추천 종목들을 조회
   */
  static async getLatestRecommends(): Promise<MarketRecommendation[]> {
    const latest = await this.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (!latest.length) {
      return [];
    }

    return this.find({ where: { batchId: latest[0].batchId } });
  }

  /**
   * 페이지네이션
   */
  static async paginate(
    request: ItemRequest & MarketRecommendationFilter,
  ): Promise<PaginatedItem<MarketRecommendation>> {
    const where: any = {};

    if (request.ticker) {
      where.symbol = Like(`%${request.ticker}%`);
    }

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions = {
      where,
      order: {
        seq: sortDirection,
      },
      skip: (request.page - 1) * request.perPage,
      take: request.perPage,
    };

    const [items, total] = await this.findAndCount(findOptions);

    return {
      items,
      total,
      page: request.page,
      perPage: request.perPage,
      totalPages: Math.ceil(total / request.perPage),
    };
  }

  /**
   * 커서 페이지네이션
   */
  static async cursor(
    request: CursorRequest<string> & MarketRecommendationFilter,
  ): Promise<CursorItem<MarketRecommendation, string>> {
    const where: any = {};

    if (request.ticker) {
      where.symbol = Like(`%${request.ticker}%`);
    }

    // startDate/endDate 또는 createdAt 처리
    if (request.startDate || request.endDate) {
      where.createdAt = Between(request.startDate ?? new Date(0), request.endDate ?? new Date());
    } else if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    if (request.cursor) {
      const cursorEntity = await this.findOne({ where: { id: request.cursor } });
      if (cursorEntity) {
        where.seq =
          sortDirection === SortDirection.DESC ? LessThanOrEqual(cursorEntity.seq) : MoreThanOrEqual(cursorEntity.seq);
      }
    }

    const findOptions = {
      where,
      order: {
        seq: sortDirection,
      },
      take: request.limit + 1,
      skip: request.cursor && request.skip ? 1 : 0,
    };

    const items = await this.find(findOptions);

    let total = items.length;
    const hasNextPage = total > request.limit;

    if (hasNextPage) {
      items.pop();
      total--;
    }

    const nextCursor = hasNextPage ? items[total - 1].id : null;

    return {
      items,
      hasNextPage,
      nextCursor,
      total,
    };
  }
}
