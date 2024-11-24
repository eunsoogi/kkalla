import {
  BaseEntity,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  FindManyOptions,
  JoinTable,
  LessThanOrEqual,
  ManyToMany,
  MoreThanOrEqual,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { User } from '@/modules/user/entities/user.entity';

import { InferenceDecisionTypes } from '../inference.enum';
import { InferenceFilter } from '../inference.interface';

@Entity()
export class Inference extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @ManyToMany(() => User, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinTable()
  users: User[];

  @Column()
  symbol!: string;

  @Column({
    type: 'enum',
    enum: InferenceDecisionTypes,
    nullable: false,
  })
  decision!: InferenceDecisionTypes;

  @Column({
    type: 'double',
    default: 0,
  })
  orderRatio: number;

  @Column({
    type: 'double',
    default: 0,
  })
  weightLowerBound: number;

  @Column({
    type: 'double',
    default: 0,
  })
  weightUpperBound: number;

  @Column({ type: 'text' })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    const where: any = {};

    if (request.users) {
      where.users = request.users;
    }

    if (request.decision) {
      where.decision = request.decision;
    }

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions: FindManyOptions<Inference> = {
      take: request.perPage,
      skip: (request.page - 1) * request.perPage,
      where,
      order: {
        seq: sortDirection,
      },
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

  public static async cursor(request: CursorRequest<string> & InferenceFilter): Promise<CursorItem<Inference, string>> {
    const where: any = {};

    if (request.users) {
      where.users = request.users;
    }

    if (request.decision) {
      where.decision = request.decision;
    }

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    if (request.cursor) {
      const cursor = await this.findOne({
        where: {
          id: request.cursor,
        },
      });

      if (cursor) {
        where.seq = sortDirection === SortDirection.DESC ? LessThanOrEqual(cursor.seq) : MoreThanOrEqual(cursor.seq);
      }
    }

    const findOptions: FindManyOptions<Inference> = {
      take: request.limit + 1,
      skip: request.cursor && request.skip ? 1 : 0,
      where,
      order: {
        seq: sortDirection,
      },
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
