import {
  BeforeInsert,
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AllocationAuditStatus, AllocationAuditVerdict, ReportType } from '../allocation-audit.interface';
import { AllocationAuditRun } from './allocation-audit-run.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

@Entity('allocation_audit_item')
@Index('idx_allocation_audit_item_source_recommendation_horizon', ['sourceRecommendationId', 'horizonHours'], {
  unique: true,
})
@Index('idx_allocation_audit_item_status_due_at', ['status', 'dueAt'])
@Index('idx_allocation_audit_item_report_type_symbol_created_at', ['reportType', 'symbol', 'createdAt'])
@Index('idx_allocation_audit_item_source_batch_horizon', ['sourceBatchId', 'horizonHours'])
export class AllocationAuditItem extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @ManyToOne(() => AllocationAuditRun, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'run_id' })
  run: AllocationAuditRun;

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ['market', 'allocation'],
    nullable: false,
  })
  reportType: ReportType;

  @Column({
    name: 'source_recommendation_id',
    ...ULID_COLUMN_OPTIONS,
    nullable: false,
  })
  sourceRecommendationId: string;

  @Column({
    name: 'source_batch_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  sourceBatchId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  symbol: string;

  @Column({
    name: 'horizon_hours',
    type: 'int',
    nullable: false,
  })
  horizonHours: number;

  @Column({
    name: 'due_at',
    type: 'datetime',
    nullable: false,
  })
  dueAt: Date;

  @Column({
    name: 'recommendation_created_at',
    type: 'datetime',
    nullable: false,
  })
  recommendationCreatedAt: Date;

  @Column({
    name: 'recommendation_reason',
    type: 'text',
    nullable: true,
  })
  recommendationReason: string | null;

  @Column({
    name: 'recommendation_confidence',
    type: 'double',
    nullable: true,
  })
  recommendationConfidence: number | null;

  @Column({
    name: 'recommendation_weight',
    type: 'double',
    nullable: true,
  })
  recommendationWeight: number | null;

  @Column({
    name: 'recommendation_intensity',
    type: 'double',
    nullable: true,
  })
  recommendationIntensity: number | null;

  @Column({
    name: 'recommendation_action',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  recommendationAction: string | null;

  @Column({
    name: 'recommendation_price',
    type: 'double',
    nullable: true,
  })
  recommendationPrice: number | null;

  @Column({
    name: 'evaluated_price',
    type: 'double',
    nullable: true,
  })
  evaluatedPrice: number | null;

  @Column({
    name: 'return_pct',
    type: 'double',
    nullable: true,
  })
  returnPct: number | null;

  @Column({
    name: 'direction_hit',
    type: 'boolean',
    nullable: true,
  })
  directionHit: boolean | null;

  @Column({
    name: 'realized_trade_pnl',
    type: 'double',
    nullable: true,
  })
  realizedTradePnl: number | null;

  @Column({
    name: 'realized_trade_amount',
    type: 'double',
    nullable: true,
  })
  realizedTradeAmount: number | null;

  @Column({
    name: 'trade_roi_pct',
    type: 'double',
    nullable: true,
  })
  tradeRoiPct: number | null;

  @Column({
    name: 'deterministic_score',
    type: 'double',
    nullable: true,
  })
  deterministicScore: number | null;

  @Column({
    name: 'ai_verdict',
    type: 'enum',
    enum: ['good', 'mixed', 'bad', 'invalid'],
    nullable: true,
  })
  aiVerdict: AllocationAuditVerdict | null;

  @Column({
    name: 'ai_score',
    type: 'double',
    nullable: true,
  })
  aiScore: number | null;

  @Column({
    name: 'ai_calibration',
    type: 'double',
    nullable: true,
  })
  aiCalibration: number | null;

  @Column({
    name: 'ai_explanation',
    type: 'text',
    nullable: true,
  })
  aiExplanation: string | null;

  @Column({
    name: 'next_guardrail',
    type: 'text',
    nullable: true,
  })
  nextGuardrail: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    nullable: false,
  })
  status: AllocationAuditStatus;

  @Column({
    name: 'evaluated_at',
    type: 'datetime',
    nullable: true,
  })
  evaluatedAt: Date | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
