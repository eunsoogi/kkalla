import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '@/modules/category/category.enum';
import { User } from '@/modules/user/entities/user.entity';

@Entity()
export class HoldingLedger extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
