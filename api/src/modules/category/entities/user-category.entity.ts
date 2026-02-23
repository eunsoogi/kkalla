import {
  BeforeInsert,
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Category } from '../category.enum';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity()
@Index('idx_user_category_user_enabled_category', ['user', 'enabled', 'category'])
export class UserCategory extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @ManyToOne(() => User)
  user: User;

  @Column({
    type: 'enum',
    enum: Category,
  })
  category: Category;

  @Column({
    default: true,
  })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
