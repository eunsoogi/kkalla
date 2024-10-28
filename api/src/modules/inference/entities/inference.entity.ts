import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { InferenceDicisionTypes } from '../inference.interface';

@Entity({
  orderBy: {
    id: 'ASC',
  },
})
export class Inference extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: InferenceDicisionTypes, nullable: false })
  decision!: InferenceDicisionTypes;

  @Column({ default: 0 })
  krwBalance: number;

  @Column({ default: 0 })
  coinBalance: number;

  @Column({ default: 0 })
  suggestedBalance: number;

  @Column()
  reason?: string;

  @Column()
  reflection?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
