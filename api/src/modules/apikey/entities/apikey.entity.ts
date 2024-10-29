import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ApikeyTypes } from '../apikey.interface';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class Apikey extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  @Column({ type: 'enum', enum: ApikeyTypes, nullable: false, unique: true })
  type!: ApikeyTypes;

  @Column()
  accessKey: string;

  @Column({ nullable: false })
  secretKey!: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
