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

import { User } from '@/modules/user/entities/user.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class Schedule extends BaseEntity {
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
    default: false,
  })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async findByEnabled(): Promise<Schedule[]> {
    return this.find({
      relations: {
        user: true,
      },
      where: {
        enabled: true,
      },
    });
  }

  public static async findByUser(user: User): Promise<Schedule> {
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
