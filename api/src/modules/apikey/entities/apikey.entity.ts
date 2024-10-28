import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ApikeyTypes } from '../apikey.interface';

@Entity({
  orderBy: {
    id: 'ASC',
  },
})
export class Apikey extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: ApikeyTypes, nullable: false, unique: true })
  type!: ApikeyTypes;

  @Column({ nullable: false })
  accessKey!: string;

  @Column()
  secretKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
