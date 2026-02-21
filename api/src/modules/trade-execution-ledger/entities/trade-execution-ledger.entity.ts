import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { TradeExecutionLedgerStatus } from '../trade-execution-ledger.enum';

@Entity()
@Index('idx_trade_execution_ledger_module_message_user', ['module', 'messageKey', 'userId'], { unique: true })
export class TradeExecutionLedger extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
  })
  module: string;

  @Column({
    type: 'varchar',
    length: 191,
    nullable: false,
  })
  messageKey: string;

  @Column({
    type: 'varchar',
    length: 191,
    nullable: false,
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: TradeExecutionLedgerStatus.PROCESSING,
    nullable: false,
  })
  status: TradeExecutionLedgerStatus;

  @Column({
    type: 'int',
    default: 1,
    nullable: false,
  })
  attemptCount: number;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: false,
  })
  payloadHash: string;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  generatedAt: Date | null;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  startedAt: Date | null;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  finishedAt: Date | null;

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
