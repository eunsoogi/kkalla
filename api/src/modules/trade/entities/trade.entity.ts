import {
  BaseEntity,
  BeforeInsert,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  LessThanOrEqual,
  Like,
  ManyToOne,
  MoreThanOrEqual,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.types';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

import { TradeFilter } from '../trade.types';

@Entity()
@Index('idx_trade_user_id', ['user', 'id'])
export class Trade extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @ManyToOne(() => User, {
    nullable: false,
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column({
    type: 'enum',
    enum: OrderTypes,
    nullable: false,
  })
  type: OrderTypes;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  symbol: string;

  @Column({
    type: 'double',
    nullable: false,
  })
  amount: number;

  @Column({
    type: 'double',
    default: 0,
  })
  profit: number = 0;

  @Column({
    type: 'varchar',
    length: 24,
    nullable: true,
  })
  executionMode: 'market' | 'limit_ioc' | 'limit_post_only' | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  orderType: 'market' | 'limit' | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  timeInForce: string | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  requestPrice: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  averagePrice: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  requestedAmount: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  filledAmount: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  filledRatio: number | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  orderStatus: string | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  expectedEdgeRate: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  estimatedCostRate: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  spreadRate: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  impactRate: number | null;

  @Column({
    type: 'double',
    nullable: true,
  })
  missedOpportunityCost: number | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  gateBypassedReason: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  triggerReason: string | null;

  @ManyToOne(() => AllocationRecommendation, { nullable: true, cascade: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn()
  inference: AllocationRecommendation;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Handles paginate in the backend service workflow.
   * @param user - User identifier related to this operation.
   * @param request - Request payload for the backend service operation.
   * @returns Asynchronous result produced by the backend service flow.
   */
  public static async paginate(user: User, request: ItemRequest & TradeFilter): Promise<PaginatedItem<Trade>> {
    const where: any = {
      user: {
        id: user.id,
      },
      type: request.type,
    };

    if (request.symbol) {
      where.symbol = Like(`%${request.symbol}%`);
    }

    if (request.type) {
      where.type = request.type;
    }

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions = {
      where,
      relations: {
        user: true,
      },
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
   * Handles cursor in the backend service workflow.
   * @param user - User identifier related to this operation.
   * @param request - Request payload for the backend service operation.
   * @returns Formatted string output for the operation.
   */
  public static async cursor(
    user: User,
    request: CursorRequest<string> & TradeFilter,
  ): Promise<CursorItem<Trade, string>> {
    const where: any = {
      user: {
        id: user.id,
      },
    };

    if (request.symbol) {
      where.symbol = Like(`%${request.symbol}%`);
    }

    if (request.type) {
      where.type = request.type;
    }

    if (request.createdAt) {
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
      relations: {
        user: true,
      },
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
