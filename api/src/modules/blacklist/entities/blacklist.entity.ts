import { BaseEntity, Column, CreateDateColumn, Entity, Like, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { InferenceCategory } from '@/modules/inference/inference.enum';
import { PaginatedItem } from '@/modules/item/item.interface';

import { GetBlacklistsDto } from '../dto/get-blacklists.dto';

@Entity()
export class Blacklist extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false })
  ticker!: string;

  @Column({
    type: 'enum',
    enum: InferenceCategory,
    nullable: false,
  })
  category!: InferenceCategory;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(params: GetBlacklistsDto): Promise<PaginatedItem<Blacklist>> {
    const where: any = {};

    if (params.search) {
      where.ticker = Like(`%${params.search}%`);
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
