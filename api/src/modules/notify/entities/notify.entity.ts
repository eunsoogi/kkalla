import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  FindManyOptions,
  Index,
  JoinColumn,
  LessThanOrEqual,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { User } from '@/modules/user/entities/user.entity';

@Entity()
@Index('idx_notify_user_seq', ['user', 'seq'])
export class Notify extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    unique: true,
    nullable: false,
  })
  seq: number;

  @ManyToOne(() => User, {
    nullable: false,
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column({
    type: 'text',
    nullable: false,
  })
  message: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async findAllByUser(user: User): Promise<Notify[]> {
    return this.find({
      relations: {
        user: true,
      },
      where: {
        user: {
          id: user.id,
        },
      },
    });
  }

  public static async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Notify>> {
    const [items, total] = await this.findAndCount({
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
        seq: 'DESC',
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

  public static async cursor(user: User, request: CursorRequest<string>): Promise<CursorItem<Notify, string>> {
    const findOptions: FindManyOptions<Notify> = {
      take: request.limit + 1,
      skip: request.cursor && request.skip ? 1 : 0,
      relations: {
        user: true,
      },
      where: {
        user: {
          id: user.id,
        },
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
