import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EncryptionTransformer } from 'typeorm-encrypted';

import { typeORMEncryptionConfig } from '@/databases/typeorm.config';
import { User } from '@/modules/user/entities/user.entity';

import { ApikeyTypes } from '../apikey.enum';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
@Unique(['user', 'type'])
export class Apikey extends BaseEntity {
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
    enum: ApikeyTypes,
    nullable: false,
  })
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

  public static async findByType(user: User, type: ApikeyTypes): Promise<Apikey> {
    return this.findOne({
      relations: {
        user: true,
      },
      where: {
        user: {
          id: user.id,
        },
        type,
      },
    });
  }
}
