import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  FindManyOptions,
  JoinTable,
  LessThanOrEqual,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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
  rate: number;

  @Column({
    type: 'double',
    default: 0,
  })
  symbolRateLower: number;

  @Column({
    type: 'double',
    default: 0,
  })
  symbolRateUpper: number;

  @Column({ type: 'text' })
  reason?: string;

  @Column({ type: 'text' })
  reflection?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    const findOptions: FindManyOptions<Inference> = {
      take: request.perPage,
      skip: (request.page - 1) * request.perPage,
      where: {
        users: request.users,
      },
      order: {
        seq: 'DESC',
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
    const findOptions: FindManyOptions<Inference> = {
      take: request.limit + 1,
      skip: request.cursor && request.skip ? 1 : 0,
      where: {
        users: request.users,
      },
      order: {
        seq: 'DESC',
      },
    };

    if (request.cursor) {
      const cursor = await this.findOne({
        where: {
          id: request.cursor,
        },
      });

      if (cursor) {
        findOptions.where = {
          ...findOptions.where,
          seq: LessThanOrEqual(cursor.seq),
        };
      }
    }

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
