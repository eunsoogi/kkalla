import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '@/modules/category/category.enum';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity()
@Index(
  'idx_trade_cost_calibration_snapshot_bucket',
  ['version', 'category', 'costTier', 'positionClass', 'regimeSource'],
  { unique: true },
)
export class TradeCostCalibrationSnapshot extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @Column({
    type: 'int',
    nullable: false,
  })
  version: number;

  @Column({
    type: 'enum',
    enum: Category,
    nullable: false,
  })
  category: Category;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
  })
  costTier: 'low' | 'medium' | 'high';

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
  })
  positionClass: 'existing' | 'new';

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
  })
  regimeSource: 'live' | 'cache_fallback' | 'unavailable_risk_off';

  @Column({
    type: 'int',
    nullable: false,
  })
  sampleSize: number;

  @Column({
    type: 'datetime',
    nullable: false,
  })
  windowStart: Date;

  @Column({
    type: 'datetime',
    nullable: false,
  })
  windowEnd: Date;

  @Column({
    type: 'datetime',
    nullable: false,
  })
  lastTradeAt: Date;

  @Column({
    type: 'double',
    nullable: false,
  })
  rawMultiplier: number;

  @Column({
    type: 'double',
    nullable: false,
  })
  appliedMultiplier: number;

  @Column({
    type: 'boolean',
    nullable: false,
  })
  clampApplied: boolean;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
  })
  status: 'active' | 'warmup' | 'stale' | 'invalid';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
