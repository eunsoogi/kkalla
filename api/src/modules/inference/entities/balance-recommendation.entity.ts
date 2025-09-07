import {
  BaseEntity,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '@/modules/category/category.enum';
import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { BalanceRecommendationFilter, RecentBalanceRecommendationRequest } from '../inference.interface';

@Entity()
@Index('idx_balance_recommendation_batch_id_symbol', ['batchId', 'symbol'], { unique: true })
@Index('idx_balance_recommendation_symbol', ['symbol'])
@Index('idx_balance_recommendation_category_seq', ['category', 'seq'])
@Index('idx_balance_recommendation_category_symbol_seq', ['category', 'symbol', 'seq'])
@Index('idx_balance_recommendation_category_created_at', ['category', 'createdAt'])
@Index('idx_balance_recommendation_category_symbol_created_at', ['category', 'symbol', 'createdAt'])
export class BalanceRecommendation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  batchId: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  symbol: string;

  @Column({
    type: 'enum',
    enum: Category,
    nullable: false,
  })
  category: Category;

  @Column({
    type: 'double',
    default: 0,
    nullable: false,
  })
  rate: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async getRecent(request: RecentBalanceRecommendationRequest): Promise<BalanceRecommendation[]> {
    return await this.find({
      where: {
        symbol: request.symbol,
        createdAt: MoreThanOrEqual(request.createdAt),
      },
      order: {
        createdAt: 'DESC',
      },
      take: request.count,
    });
  }

  public static async paginate(
    request: ItemRequest & BalanceRecommendationFilter,
  ): Promise<PaginatedItem<BalanceRecommendation>> {
    const where: any = {
      category: request.category,
    };

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

  public static async cursor(
    request: CursorRequest<string> & BalanceRecommendationFilter,
  ): Promise<CursorItem<BalanceRecommendation, string>> {
    const where: any = {
      category: request.category,
    };

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
      const cursor = await this.findOne({
        where: { id: request.cursor },
      });

      if (cursor) {
        where.seq = sortDirection === SortDirection.DESC ? LessThanOrEqual(cursor.seq) : MoreThanOrEqual(cursor.seq);
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
