import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '@/modules/category/category.enum';
import { User } from '@/modules/user/entities/user.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity()
export class HoldingLedger extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  symbol: string;

  @Column({
    type: 'enum',
    enum: Category,
    nullable: false,
  })
  category: Category;

  @Column({
    type: 'int',
    nullable: false,
  })
  index: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
