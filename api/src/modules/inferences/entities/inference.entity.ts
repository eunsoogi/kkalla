import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  FindManyOptions,
  JoinColumn,
  LessThan,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/interfaces/item.interface';
import { User } from '@/modules/users/entities/user.entity';

import { InferenceDicisionTypes } from '../inference.enum';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class Inference extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, {
    nullable: false,
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user!: User;

  @Column()
  symbol!: string;

  @Column({
    type: 'enum',
    enum: InferenceDicisionTypes,
    nullable: false,
  })
  decision!: InferenceDicisionTypes;

  @Column({
    type: 'double',
    default: 0,
  })
  rate: number;

  @Column({ type: 'text' })
  reason?: string;

  @Column({ type: 'text' })
  reflection?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Inference>> {
    const [items, total] = await Inference.findAndCount({
      take: request.perPage,
      skip: (request.page - 1) * request.perPage,
      relations: {
        user: true,
      },
      where: {
        user: {
          id: user.id,
        },
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    return {
      items,
      total,
      page: request.page,
      perPage: request.perPage,
      totalPages: Math.ceil(total / request.perPage),
    };
  }

  public static async cursor(user: User, request: CursorRequest): Promise<CursorItem<Inference>> {
    const findOptions: FindManyOptions<Inference> = {
      take: request.limit + 1,
      skip: request.cursor ? 1 : 0,
      relations: {
        user: true,
      },
      where: {
        user: {
          id: user.id,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    };

    if (request.cursor) {
      const cursor = await Inference.findOne({
        where: {
          id: request.cursor,
        },
      });

      findOptions.where = {
        ...findOptions.where,
        createdAt: LessThan(cursor.createdAt),
      };
    }

    const [items, total] = await Inference.findAndCount(findOptions);
    const hasNextPage = items.length > request.limit;

    if (hasNextPage) {
      items.pop();
    }

    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return {
      items,
      hasNextPage,
      nextCursor,
      total,
    };
  }
}
