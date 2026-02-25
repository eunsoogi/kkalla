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

import { Category } from '@/modules/category/category.enum';
import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

import {
  AllocationRecommendationAction,
  AllocationRecommendationFilter,
  RecentAllocationRecommendationRequest,
} from '../allocation.interface';

@Entity()
@Index('idx_allocation_recommendation_batch_id_symbol', ['batchId', 'symbol'], { unique: true })
@Index('idx_allocation_recommendation_symbol', ['symbol'])
@Index('idx_allocation_recommendation_category_id', ['category', 'id'])
@Index('idx_allocation_recommendation_category_symbol_id', ['category', 'symbol', 'id'])
@Index('idx_allocation_recommendation_category_created_at', ['category', 'createdAt'])
@Index('idx_allocation_recommendation_category_symbol_created_at', ['category', 'symbol', 'createdAt'])
export class AllocationRecommendation extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @Column({
    ...ULID_COLUMN_OPTIONS,
    nullable: false,
  })
  batchId: string;

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
    type: 'enum',
    enum: Category,
    nullable: false,
  })
  category: Category;

  @Column({
    name: 'intensity',
    type: 'double',
    default: 0,
    nullable: false,
  })
  intensity: number;

  @Column({
    name: 'prev_intensity',
    type: 'double',
    nullable: true,
  })
  prevIntensity: number | null;

  @Column({
    type: 'double',
    default: 0,
    nullable: false,
  })
  buyScore: number;

  @Column({
    type: 'double',
    default: 0,
    nullable: false,
  })
  sellScore: number;

  @Column({
    name: 'model_target_weight',
    type: 'double',
    default: 0,
    nullable: false,
  })
  modelTargetWeight: number;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'hold',
    nullable: false,
  })
  action: AllocationRecommendationAction;

  @Column({
    type: 'text',
    nullable: true,
  })
  reason: string | null;

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
   * Retrieves recent for the allocation recommendation flow.
   * @param request - Request payload for the allocation recommendation operation.
   * @returns Processed collection for downstream workflow steps.
   */
  public static async getRecent(request: RecentAllocationRecommendationRequest): Promise<AllocationRecommendation[]> {
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

  /**
   * Handles paginate in the allocation recommendation workflow.
   * @param request - Request payload for the allocation recommendation operation.
   * @returns Asynchronous result produced by the allocation recommendation flow.
   */
  public static async paginate(
    request: ItemRequest & AllocationRecommendationFilter,
  ): Promise<PaginatedItem<AllocationRecommendation>> {
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
   * Handles cursor in the allocation recommendation workflow.
   * @param request - Request payload for the allocation recommendation operation.
   * @returns Formatted string output for the operation.
   */
  public static async cursor(
    request: CursorRequest<string> & AllocationRecommendationFilter,
  ): Promise<CursorItem<AllocationRecommendation, string>> {
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
        where.id = sortDirection === SortDirection.DESC ? LessThanOrEqual(cursor.id) : MoreThanOrEqual(cursor.id);
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
