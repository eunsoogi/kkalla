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

import { FindItemDto } from '@/dto/find-item.dto';
import { PaginatedItemDto } from '@/dto/paginated-item.dto';
import { Inference } from '@/modules/inferences/entities/inference.entity';
import { User } from '@/modules/users/entities/user.entity';

import { BalanceTypes, TradeTypes } from '../trade.type';

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
    enum: TradeTypes,
    nullable: false,
  })
  type!: TradeTypes;

  @Column({ nullable: false })
  symbol!: string;

  @Column({
    type: 'double',
    nullable: false,
  })
  amount!: number;

  @Column(() => BalanceTypes)
  balance: BalanceTypes;

  @OneToOne(() => Inference, {
    eager: true,
  })
  @JoinColumn()
  inference: Inference;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(user: User, findItemDto: FindItemDto): Promise<PaginatedItemDto<Trade>> {
    const [items, total] = await Trade.findAndCount({
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