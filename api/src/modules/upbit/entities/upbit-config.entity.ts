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
import { EncryptionTransformer } from 'typeorm-encrypted';

import { typeORMEncryptionConfig } from '@/databases/typeorm.config';
import { User } from '@/modules/user/entities/user.entity';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class UpbitConfig extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, {
    nullable: false,
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column({
    type: 'text',
    nullable: false,
    transformer: new EncryptionTransformer(typeORMEncryptionConfig),
  })
  accessKey: string;

  @Column({
    type: 'text',
    nullable: false,
    transformer: new EncryptionTransformer(typeORMEncryptionConfig),
  })
  secretKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async findByUser(user: User): Promise<UpbitConfig> {
    return this.findOne({
      relations: {
        user: true,
      },
      where: {
        user: {
          id: user.id,
        },
      },
    });
  }
}
