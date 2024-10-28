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
}
