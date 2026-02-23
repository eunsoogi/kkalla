import {
  BeforeInsert,
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AllocationAuditStatus, ReportType } from '../allocation-audit.interface';
import { AllocationAuditItem } from './allocation-audit-item.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity('allocation_audit_run')
@Index('idx_allocation_audit_run_report_type_batch_horizon', ['reportType', 'sourceBatchId', 'horizonHours'], {
  unique: true,
})
export class AllocationAuditRun extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ['market', 'allocation'],
    nullable: false,
  })
  reportType: ReportType;

  @Column({
    name: 'source_batch_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  sourceBatchId: string;

  @Column({
    name: 'horizon_hours',
    type: 'int',
    nullable: false,
  })
  horizonHours: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    nullable: false,
  })
  status: AllocationAuditStatus;

  @Column({
    name: 'item_count',
    type: 'int',
    default: 0,
    nullable: false,
  })
  itemCount: number;

  @Column({
    name: 'completed_count',
    type: 'int',
    default: 0,
    nullable: false,
  })
  completedCount: number;

  @Column({
    name: 'deterministic_score_avg',
    type: 'double',
    nullable: true,
  })
  deterministicScoreAvg: number | null;

  @Column({
    name: 'ai_score_avg',
    type: 'double',
    nullable: true,
  })
  aiScoreAvg: number | null;

  @Column({
    name: 'overall_score',
    type: 'double',
    nullable: true,
  })
  overallScore: number | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  summary: string | null;

  @Column({
    name: 'started_at',
    type: 'datetime',
    nullable: true,
  })
  startedAt: Date | null;

  @Column({
    name: 'completed_at',
    type: 'datetime',
    nullable: true,
  })
  completedAt: Date | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  error: string | null;

  @OneToMany(() => AllocationAuditItem, (item) => item.run)
  items: AllocationAuditItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
