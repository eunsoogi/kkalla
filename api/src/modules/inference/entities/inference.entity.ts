import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { FindInferenceDto } from '../dto/find-inference.dto';
import { PaginatedInferenceDto } from '../dto/paginated-inference.dto';
import { InferenceDicisionTypes } from '../inference.interface';

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

  public static async paginate(findInferenceDto: FindInferenceDto): Promise<PaginatedInferenceDto> {
    const [items, total] = await Inference.findAndCount({
      take: findInferenceDto.perPage,
      skip: (findInferenceDto.page - 1) * findInferenceDto.perPage,
      order: {
        updatedAt: 'DESC',
      },
    });

    return {
      items,
      total,
      page: findInferenceDto.page,
      perPage: findInferenceDto.perPage,
      totalPages: Math.ceil(total / findInferenceDto.perPage),
    };
  }
}
