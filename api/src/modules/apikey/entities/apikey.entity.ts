import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EncryptionTransformer } from 'typeorm-encrypted';

import { typeORMEncryptionConfig } from '@/typeorm.config';

import { ApikeyTypes } from '../apikey.type';

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

  @Column({
    type: 'text',
    default: '',
    transformer: new EncryptionTransformer(typeORMEncryptionConfig),
  })
  accessKey: string;

  @Column({
    type: 'text',
    nullable: false,
    transformer: new EncryptionTransformer(typeORMEncryptionConfig),
  })
  secretKey!: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
