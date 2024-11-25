import {
  BaseEntity,
  Between,
  Column,
  CreateDateColumn,
  Entity,
  LessThanOrEqual,
  MoreThanOrEqual,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Decision } from '@/modules/decision/entities/decision.entity';
import { SortDirection } from '@/modules/item/item.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { InferenceFilter } from '../inference.interface';

@Entity()
export class Inference extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @Column()
  symbol: string;

  @OneToMany(() => Decision, (decision) => decision.inference, {
    eager: true,
    cascade: true,
  })
  decisions: Decision[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    const where: any = {};

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    if (request.decision) {
      where.decisions = {
        decision: request.decision,
      };
    }

    if (request.users?.id) {
      where.decisions = {
        ...where.decisions,
        users: {
          id: request.users.id,
        },
      };
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions = {
      relations: ['decisions', 'decisions.users'],
      where,
      order: {
        seq: sortDirection,
      },
      skip: (request.page - 1) * request.perPage,
      take: request.perPage,
    };

    const [items, total] = await this.findAndCount(findOptions);

    items.forEach((inference) => {
      inference.decisions = inference.decisions.filter((decision) => {
        let match = true;
        if (request.decision) {
          match = match && decision.decision === request.decision;
        }
        if (request.users?.id) {
          match = match && decision.users.some((user) => user.id === request.users.id);
        }
        return match;
      });
    });

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

    if (request.createdAt) {
      where.createdAt = Between(request.createdAt?.gte ?? new Date(0), request.createdAt?.lte ?? new Date());
    }

    if (request.decision) {
      where.decisions = {
        decision: request.decision,
      };
    }

    if (request.users?.id) {
      where.decisions = {
        ...where.decisions,
        users: {
          id: request.users.id,
        },
      };
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
      relations: ['decisions', 'decisions.users'],
      where,
      order: {
        seq: sortDirection,
      },
      take: request.limit + 1,
    };

    const items = await this.find(findOptions);

    items.forEach((inference) => {
      inference.decisions = inference.decisions.filter((decision) => {
        let match = true;
        if (request.decision) {
          match = match && decision.decision === request.decision;
        }
        if (request.users?.id) {
          match = match && decision.users.some((user) => user.id === request.users.id);
        }
        return match;
      });
    });

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
