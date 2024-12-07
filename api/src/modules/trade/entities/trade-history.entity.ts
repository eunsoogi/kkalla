import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { InferenceCategory } from '@/modules/inference/inference.enum';

@Entity()
export class TradeHistory extends BaseEntity {
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
}
