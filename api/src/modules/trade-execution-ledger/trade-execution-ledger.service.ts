import { Injectable } from '@nestjs/common';

import { createHash } from 'crypto';
import { IsNull } from 'typeorm';

import { normalizeIdentifierToUlid } from '@/utils/id';

import { TradeExecutionLedger } from './entities/trade-execution-ledger.entity';
import { TradeExecutionLedgerStatus } from './trade-execution-ledger.enum';
import {
  TradeExecutionLedgerAcquireInput,
  TradeExecutionLedgerAcquireResult,
  TradeExecutionLedgerMarkInput,
} from './trade-execution-ledger.types';

function isDuplicateInsertError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT';
}

@Injectable()
export class TradeExecutionLedgerService {
  private readonly PROCESSING_STALE_MS = 5 * 60 * 1000;

  public getProcessingStaleMs(): number {
    return this.PROCESSING_STALE_MS;
  }

  public hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(payload ?? {}))
      .digest('hex');
  }

  public async acquire(input: TradeExecutionLedgerAcquireInput): Promise<TradeExecutionLedgerAcquireResult> {
    const normalizedInput = this.normalizeAcquireInput(input);
    const existing = await this.findByUniqueKey(normalizedInput);

    if (existing) {
      return this.resolveExistingAcquire(normalizedInput, existing);
    }

    const row = new TradeExecutionLedger();
    row.module = normalizedInput.module;
    row.messageKey = normalizedInput.messageKey;
    row.userId = normalizedInput.userId;
    row.status = TradeExecutionLedgerStatus.PROCESSING;
    row.attemptCount = 1;
    row.payloadHash = normalizedInput.payloadHash;
    row.generatedAt = normalizedInput.generatedAt ?? null;
    row.expiresAt = normalizedInput.expiresAt ?? null;
    row.startedAt = new Date();
    row.finishedAt = null;
    row.error = null;

    try {
      await row.save();
      return {
        acquired: true,
        status: TradeExecutionLedgerStatus.PROCESSING,
        attemptCount: row.attemptCount,
      };
    } catch (error) {
      if (!isDuplicateInsertError(error)) {
        throw error;
      }

      // A concurrent worker may have inserted PROCESSING first. Re-read and preserve
      // the winner's state instead of forcing it to DUPLICATE.
      const raced = await this.findByUniqueKey(normalizedInput);
      if (raced) {
        return this.resolveExistingAcquire(normalizedInput, raced);
      }

      // If we still cannot read the row, keep the message retriable.
      return { acquired: false, status: TradeExecutionLedgerStatus.PROCESSING };
    }
  }

  public async markSucceeded(input: TradeExecutionLedgerMarkInput): Promise<void> {
    await this.markStatus(input, TradeExecutionLedgerStatus.SUCCEEDED, null);
  }

  public async markRetryableFailed(input: TradeExecutionLedgerMarkInput): Promise<void> {
    await this.markStatus(input, TradeExecutionLedgerStatus.RETRYABLE_FAILED, input.error ?? null);
  }

  public async markNonRetryableFailed(input: TradeExecutionLedgerMarkInput): Promise<void> {
    await this.markStatus(input, TradeExecutionLedgerStatus.NON_RETRYABLE_FAILED, input.error ?? null);
  }

  public async markStaleSkipped(input: TradeExecutionLedgerMarkInput): Promise<void> {
    await this.markStatus(input, TradeExecutionLedgerStatus.STALE_SKIPPED, input.error ?? null);
  }

  public async markDuplicate(input: TradeExecutionLedgerMarkInput): Promise<void> {
    await this.markStatus(input, TradeExecutionLedgerStatus.DUPLICATE, input.error ?? null);
  }

  public async heartbeatProcessing(
    input: Pick<TradeExecutionLedgerMarkInput, 'module' | 'messageKey' | 'userId' | 'attemptCount'>,
  ): Promise<void> {
    const normalizedUserId = this.normalizeUserId(input.userId);
    const whereCondition: {
      module: string;
      messageKey: string;
      userId: string;
      status: TradeExecutionLedgerStatus;
      attemptCount?: number;
    } = {
      module: input.module,
      messageKey: input.messageKey,
      userId: normalizedUserId,
      status: TradeExecutionLedgerStatus.PROCESSING,
    };

    if (this.isValidAttemptCount(input.attemptCount)) {
      whereCondition.attemptCount = input.attemptCount;
    }

    await TradeExecutionLedger.update(whereCondition, {
      startedAt: new Date(),
    });
  }

  private async findByUniqueKey(input: Pick<TradeExecutionLedgerAcquireInput, 'module' | 'messageKey' | 'userId'>) {
    const normalizedUserId = this.normalizeUserId(input.userId);
    return TradeExecutionLedger.findOne({
      where: {
        module: input.module,
        messageKey: input.messageKey,
        userId: normalizedUserId,
      },
    });
  }

  private isProcessingStale(row: TradeExecutionLedger): boolean {
    const now = Date.now();
    const expiresAtTs = row.expiresAt?.getTime();
    if (Number.isFinite(expiresAtTs) && expiresAtTs <= now) {
      return true;
    }

    const startedAtTs = row.startedAt?.getTime();
    if (!Number.isFinite(startedAtTs)) {
      return false;
    }

    return startedAtTs + this.PROCESSING_STALE_MS <= now;
  }

  private async resolveExistingAcquire(
    input: TradeExecutionLedgerAcquireInput,
    existing: TradeExecutionLedger,
  ): Promise<TradeExecutionLedgerAcquireResult> {
    if (
      existing.status === TradeExecutionLedgerStatus.RETRYABLE_FAILED ||
      (existing.status === TradeExecutionLedgerStatus.PROCESSING && this.isProcessingStale(existing))
    ) {
      const reacquiredAttemptCount = await this.tryReacquireAtomically(input, existing);
      if (this.isValidAttemptCount(reacquiredAttemptCount)) {
        return {
          acquired: true,
          status: TradeExecutionLedgerStatus.PROCESSING,
          attemptCount: reacquiredAttemptCount,
        };
      }

      // Another worker updated this row first. Keep this message retriable.
      return { acquired: false, status: TradeExecutionLedgerStatus.PROCESSING };
    }

    if (existing.status === TradeExecutionLedgerStatus.PROCESSING) {
      return { acquired: false, status: TradeExecutionLedgerStatus.PROCESSING };
    }

    // Duplicate deliveries should preserve the terminal status for observability.
    return {
      acquired: false,
      status: existing.status,
    };
  }

  private async tryReacquireAtomically(
    input: TradeExecutionLedgerAcquireInput,
    existing: TradeExecutionLedger,
  ): Promise<number | null> {
    const currentAttemptCount = existing.attemptCount ?? 0;
    const nextAttemptCount = currentAttemptCount + 1;
    const updateResult = await TradeExecutionLedger.update(
      {
        id: existing.id,
        status: existing.status,
        attemptCount: currentAttemptCount,
        // Guard against heartbeat races: only reacquire if startedAt is unchanged.
        startedAt: existing.startedAt ?? IsNull(),
      },
      {
        status: TradeExecutionLedgerStatus.PROCESSING,
        attemptCount: nextAttemptCount,
        payloadHash: input.payloadHash,
        generatedAt: input.generatedAt ?? existing.generatedAt,
        expiresAt: input.expiresAt ?? existing.expiresAt,
        error: null,
        startedAt: new Date(),
        finishedAt: null,
      },
    );

    return (updateResult.affected ?? 0) > 0 ? nextAttemptCount : null;
  }

  private async markStatus(
    input: Pick<TradeExecutionLedgerMarkInput, 'module' | 'messageKey' | 'userId' | 'attemptCount'>,
    status: TradeExecutionLedgerStatus,
    error?: string | null,
  ): Promise<void> {
    const normalizedUserId = this.normalizeUserId(input.userId);
    const whereCondition: {
      module: string;
      messageKey: string;
      userId: string;
      status: TradeExecutionLedgerStatus;
      attemptCount?: number;
    } = {
      module: input.module,
      messageKey: input.messageKey,
      userId: normalizedUserId,
      status: TradeExecutionLedgerStatus.PROCESSING,
    };

    if (this.isValidAttemptCount(input.attemptCount)) {
      whereCondition.attemptCount = input.attemptCount;
    }

    await TradeExecutionLedger.update(whereCondition, {
      status,
      finishedAt: new Date(),
      error: error ?? null,
    });
  }

  private isValidAttemptCount(attemptCount: unknown): attemptCount is number {
    return typeof attemptCount === 'number' && Number.isFinite(attemptCount) && attemptCount > 0;
  }

  private normalizeAcquireInput(input: TradeExecutionLedgerAcquireInput): TradeExecutionLedgerAcquireInput {
    return {
      ...input,
      userId: this.normalizeUserId(input.userId),
    };
  }

  private normalizeUserId(userId: string): string {
    return normalizeIdentifierToUlid(userId);
  }
}
