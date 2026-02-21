import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReportType, ReportValidationStatus } from '../report-validation.interface';
import { ReportValidationItem } from './report-validation-item.entity';

@Entity('report_validation_run')
@Index('idx_report_validation_run_report_type_batch_horizon', ['reportType', 'sourceBatchId', 'horizonHours'], {
  unique: true,
})
export class ReportValidationRun extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    unique: true,
  })
  seq: number;

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ['market', 'portfolio'],
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
  status: ReportValidationStatus;

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

  @OneToMany(() => ReportValidationItem, (item) => item.run)
  items: ReportValidationItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
