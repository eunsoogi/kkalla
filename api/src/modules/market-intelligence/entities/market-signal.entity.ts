import {
  BaseEntity,
  BeforeInsert,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.types';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

import { MarketSignalFilter } from '../market-intelligence.types';

@Entity()
@Index('idx_market_signal_batch_id', ['batchId'])
@Index('idx_market_signal_symbol_id', ['symbol', 'id'])
@Index('idx_market_signal_symbol_created_at', ['symbol', 'createdAt'])
@Index('idx_market_signal_created_at', ['createdAt'])
export class MarketSignal extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  symbol: string;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: false,
  })
  weight: number;

  @Column({
    type: 'text',
    nullable: false,
  })
  reason: string;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: false,
  })
  confidence: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  batchId: string;

  @Column({
    type: 'double',
    nullable: true,
  })
  recommendationPrice: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  btcDominance: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  altcoinIndex: number | null;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  marketRegimeAsOf: Date | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  marketRegimeSource: 'live' | 'cache_fallback' | null;

  @Column({
    type: 'boolean',
    nullable: true,
  })
  marketRegimeIsStale: boolean | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  feargreedIndex: number | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  feargreedClassification: string | null;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  feargreedTimestamp: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * 최신 추천 종목들을 조회
   */
  static async getLatestSignals(): Promise<MarketSignal[]> {
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
  static async paginate(request: ItemRequest & MarketSignalFilter): Promise<PaginatedItem<MarketSignal>> {
    const where: any = {};

    if (request.symbol) {
      where.symbol = Like(`%${request.symbol}%`);
    }

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions = {
      where,
      order: {
        id: sortDirection,
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
  static async cursor(request: CursorRequest<string> & MarketSignalFilter): Promise<CursorItem<MarketSignal, string>> {
    const where: any = {};

    if (request.symbol) {
      where.symbol = Like(`%${request.symbol}%`);
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
        where.id =
          sortDirection === SortDirection.DESC ? LessThanOrEqual(cursorEntity.id) : MoreThanOrEqual(cursorEntity.id);
      }
    }

    const findOptions = {
      where,
      order: {
        id: sortDirection,
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
