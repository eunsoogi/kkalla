import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Inference } from '../../inference/entities/inference.entity';
import { TradeTypes } from '../trade.interface';

export class BalanceTypes {
  @Column({ type: 'double', default: 0 })
  krw: number;

  @Column({ type: 'double', default: 0 })
  coin: number;
}

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class Trade extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  @Column({ type: 'enum', enum: TradeTypes, nullable: false })
  type!: TradeTypes;

  @Column({ nullable: false })
  symbol!: string;

  @Column({ type: 'double', nullable: false })
  cost!: number;

  @Column(() => BalanceTypes)
  balance: BalanceTypes;

  @OneToOne(() => Inference)
  @JoinColumn()
  inference: Inference;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
