import { Balances } from 'ccxt';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Inference } from '@/modules/inference/entities/inference.entity';
import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class Trade extends BaseEntity {
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
    enum: OrderTypes,
    nullable: false,
  })
  type!: OrderTypes;

  @Column({ nullable: false })
  symbol!: string;

  @Column({ nullable: false })
  market!: string;

  @Column({
    type: 'double',
    nullable: false,
  })
  amount!: number;

  @Column({
    type: 'json',
    default: '{}',
  })
  balances: Balances;

  @OneToOne(() => Inference, {
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  inference: Inference;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
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
