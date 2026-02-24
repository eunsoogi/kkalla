import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EncryptionTransformer } from 'typeorm-encrypted';

import { typeORMEncryptionConfig } from '@/databases/typeorm.config';
import { User } from '@/modules/user/entities/user.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class SlackConfig extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

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
