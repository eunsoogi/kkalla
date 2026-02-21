import { TradeExecutionLedgerStatus } from './trade-execution-ledger.enum';

export interface TradeExecutionLedgerAcquireInput {
  module: string;
  messageKey: string;
  userId: string;
  payloadHash: string;
  generatedAt?: Date | null;
  expiresAt?: Date | null;
}

export interface TradeExecutionLedgerMarkInput {
  module: string;
  messageKey: string;
  userId: string;
  attemptCount?: number;
  error?: string | null;
}

export interface TradeExecutionLedgerAcquireResult {
  acquired: boolean;
  status: TradeExecutionLedgerStatus;
  attemptCount?: number;
}
