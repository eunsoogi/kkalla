import {
  BaseEntity,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  LessThanOrEqual,
  Like,
  ManyToOne,
  MoreThanOrEqual,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Inference } from '@/modules/inference/entities/inference.entity';
import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';

import { TradeFilter } from '../trade.interface';

@Entity()
export class Trade extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @ManyToOne(() => User, {
    nullable: false,
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user!: User;

  @Column({
    type: 'enum',
    enum: OrderTypes,
    nullable: false,
  })
  type!: OrderTypes;

  @Column({ nullable: false })
  ticker!: string;

  @Column({
    type: 'double',
    nullable: false,
  })
  amount!: number;

  @Column({
    type: 'double',
    default: 0,
  })
  profit: number = 0;

  @ManyToOne(() => Inference, {
    nullable: true,
    cascade: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  inference: Inference;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(user: User, request: ItemRequest & TradeFilter): Promise<PaginatedItem<Trade>> {
    const where: any = {
      user: {
        id: user.id,
      },
      type: request.type,
    };

    if (request.ticker) {
      where.ticker = Like(`%${request.ticker}%`);
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
    user: User,
    request: CursorRequest<string> & TradeFilter,
  ): Promise<CursorItem<Trade, string>> {
    const where: any = {
      user: {
        id: user.id,
      },
    };

    if (request.ticker) {
      where.ticker = Like(`%${request.ticker}%`);
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
        where.seq = sortDirection === SortDirection.DESC ? LessThanOrEqual(cursor.seq) : MoreThanOrEqual(cursor.seq);
      }
    }

    const findOptions = {
      where,
      relations: {
        user: true,
      },
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
