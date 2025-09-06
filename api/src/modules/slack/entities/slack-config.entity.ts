import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
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
@Index(['user'])
export class SlackConfig extends BaseEntity {
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
  token: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  channel: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async findByUser(user: User): Promise<SlackConfig> {
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
