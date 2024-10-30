import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FindItemDto } from '@/dto/find-item.dto';
import { PaginatedItemDto } from '@/dto/paginated-item.dto';
import { User } from '@/modules/users/entities/user.entity';

import { InferenceDicisionTypes } from '../inference.type';

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

  public static async paginate(user: User, findItemDto: FindItemDto): Promise<PaginatedItemDto<Inference>> {
    const [items, total] = await Inference.findAndCount({
      take: findItemDto.perPage,
      skip: (findItemDto.page - 1) * findItemDto.perPage,
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
      page: findItemDto.page,
      perPage: findItemDto.perPage,
      totalPages: Math.ceil(total / findItemDto.perPage),
    };
  }
}
