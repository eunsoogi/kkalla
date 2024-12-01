import {
  BaseEntity,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  LessThanOrEqual,
  ManyToMany,
  ManyToOne,
  MoreThanOrEqual,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Inference } from '@/modules/inference/entities/inference.entity';
import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { User } from '@/modules/user/entities/user.entity';

import { DecisionTypes } from '../decision.enum';
import { DecisionFilter } from '../decision.interface';

@Entity()
export class Decision extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @ManyToOne(() => Inference, (inference) => inference.decisions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  inference: Inference;

  @ManyToMany(() => User)
  @JoinTable()
  users: User[];

  @Column({
    type: 'enum',
    enum: DecisionTypes,
    nullable: false,
  })
  decision: DecisionTypes;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(request: ItemRequest & DecisionFilter): Promise<PaginatedItem<Decision>> {
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

    const findOptions = {
      where,
      relations: ['users', 'inference'],
      order: {
        createdAt: sortDirection,
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

  public static async cursor(request: CursorRequest<string> & DecisionFilter): Promise<CursorItem<Decision, string>> {
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
        where: { id: request.cursor },
      });

      if (cursor) {
        where.seq = sortDirection === SortDirection.DESC ? LessThanOrEqual(cursor.seq) : MoreThanOrEqual(cursor.seq);
      }
    }

    const findOptions = {
      where,
      relations: ['users', 'inference'],
      order: {
        createdAt: sortDirection,
      },
      take: request.limit + 1,
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
