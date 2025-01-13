import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Category } from '@/modules/category/category.enum';

@Entity()
export class History extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false })
  ticker!: string;

  @Column({
    type: 'enum',
    enum: Category,
    nullable: false,
  })
  category!: Category;

  @Column({ nullable: false })
  index!: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
