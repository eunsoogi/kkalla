import {
  BeforeInsert,
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Like,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '@/modules/category/category.enum';
import { PaginatedItem } from '@/modules/item/item.interface';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

import { GetBlacklistsDto } from '../dto/get-blacklists.dto';

@Entity()
export class Blacklist extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(params: GetBlacklistsDto): Promise<PaginatedItem<Blacklist>> {
    const where: any = {};

    if (params.search) {
      where.symbol = Like(`%${params.search}%`);
    }

    const [items, total] = await Blacklist.findAndCount({
      where,
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }
}
