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

import { ItemRequest, PaginatedItem } from '@/interfaces/item.interface';
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
}
