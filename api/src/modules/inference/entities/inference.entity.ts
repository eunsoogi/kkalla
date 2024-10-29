import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { FindItemDto } from '../../../dto/find-item.dto';
import { PaginatedItemDto } from '../../../dto/paginated-item.dto';
import { InferenceDicisionTypes } from '../inference.type';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class Inference extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  @Column({ type: 'enum', enum: InferenceDicisionTypes, nullable: false })
  decision!: InferenceDicisionTypes;

  @Column({ type: 'double', default: 0 })
  rate: number;

  @Column({ type: 'text' })
  reason?: string;

  @Column({ type: 'text' })
  reflection?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(findItemDto: FindItemDto): Promise<PaginatedItemDto<Inference>> {
    const [items, total] = await Inference.findAndCount({
      take: findItemDto.perPage,
      skip: (findItemDto.page - 1) * findItemDto.perPage,
      order: {
        updatedAt: 'DESC',
      },
    });

    return {
      items,
      total,
      page: findItemDto.page,
      perPage: findItemDto.perPage,
      totalPages: Math.ceil(total / findItemDto.perPage),
    };
  }
}
