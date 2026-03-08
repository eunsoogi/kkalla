import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Category } from '@/modules/category/category.enum';
import { ErrorService } from '@/modules/error/error.service';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import {
  BuyCostCalibrationContext,
  BuyCostCalibrationLookupResult,
  BuyCostCalibrationReason,
  BuyCostCalibrationSnapshotStatus,
  OrderExecutionUrgency,
} from '@/modules/upbit/upbit.types';

import { TradeCostCalibrationSnapshot } from './entities/trade-cost-calibration-snapshot.entity';
import { Trade } from './entities/trade.entity';

type CalibrationBucketKey =
  `${Category}:${'low' | 'medium' | 'high'}:${'existing' | 'new'}:${'live' | 'cache_fallback' | 'unavailable_risk_off'}`;

interface AggregationRow {
  category: Category;
  costTier: 'low' | 'medium' | 'high';
  positionClass: 'existing' | 'new';
  regimeSource: 'live' | 'cache_fallback' | 'unavailable_risk_off';
  ratio: number;
  createdAt: Date;
}

@Injectable()
export class TradeCostCalibrationService {
  private readonly logger = new Logger(TradeCostCalibrationService.name);
  private readonly calibrationVersion = 1;
  private readonly recencyWindowMs = 30 * 24 * 60 * 60 * 1000;
  private readonly staleTtlMs = 24 * 60 * 60 * 1000;
  private readonly minimumActiveSampleSize = 20;
  private readonly minimumWarmupSampleSize = 5;
  private readonly maximumRawMultiplier = 3;
  private readonly maximumAppliedMultiplier = 1.5;

  constructor(private readonly errorService: ErrorService) {}

  public isBuyGateCalibrationEnabled(): boolean {
    return process.env.BUY_COST_CALIBRATION_GATE_ENABLED !== 'false';
  }

  public buildBucketKey(context: BuyCostCalibrationContext): CalibrationBucketKey {
    return `${context.category}:${context.costTier}:${context.positionClass}:${context.regimeSource}`;
  }

  public resolveCostTier(nonFeeCostRate: number): 'low' | 'medium' | 'high' {
    if (!Number.isFinite(nonFeeCostRate) || nonFeeCostRate < 0.001) {
      return 'low';
    }

    if (nonFeeCostRate < 0.0025) {
      return 'medium';
    }

    return 'high';
  }

  public resolveDecisionNonFeeCostRate(spreadRate: number | null, impactRate: number | null): number | null {
    if (spreadRate == null || impactRate == null || !Number.isFinite(spreadRate) || !Number.isFinite(impactRate)) {
      return null;
    }

    const nonFeeCostRate = Math.max(0, spreadRate) + Math.max(0, impactRate);
    return nonFeeCostRate > Number.EPSILON ? nonFeeCostRate : null;
  }

  public resolveRealizedAdverseDriftRate(requestPrice: number | null, averagePrice: number | null): number | null {
    if (
      requestPrice == null ||
      averagePrice == null ||
      !Number.isFinite(requestPrice) ||
      !Number.isFinite(averagePrice) ||
      requestPrice <= Number.EPSILON
    ) {
      return null;
    }

    const adverseDriftRate = Math.max(0, averagePrice - requestPrice) / requestPrice;
    return Number.isFinite(adverseDriftRate) ? adverseDriftRate : null;
  }

  public resolveRawMultiplier(
    realizedAdverseDriftRate: number | null,
    decisionNonFeeCostRate: number | null,
  ): number | null {
    if (
      realizedAdverseDriftRate == null ||
      decisionNonFeeCostRate == null ||
      !Number.isFinite(realizedAdverseDriftRate) ||
      !Number.isFinite(decisionNonFeeCostRate) ||
      decisionNonFeeCostRate <= Number.EPSILON
    ) {
      return null;
    }

    const ratio = realizedAdverseDriftRate / decisionNonFeeCostRate;
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > this.maximumRawMultiplier) {
      return null;
    }

    return ratio;
  }

  public applyMultiplierClamp(rawMultiplier: number): { appliedMultiplier: number; clampApplied: boolean } {
    const appliedMultiplier = Math.min(this.maximumAppliedMultiplier, Math.max(1, rawMultiplier));
    return {
      appliedMultiplier,
      clampApplied: Math.abs(appliedMultiplier - rawMultiplier) > Number.EPSILON,
    };
  }

  public resolveSnapshotStatus(
    sampleSize: number,
    rawMultiplier: number | null,
  ): BuyCostCalibrationSnapshotStatus | null {
    if (sampleSize >= this.minimumActiveSampleSize && rawMultiplier != null && Number.isFinite(rawMultiplier)) {
      return 'active';
    }

    if (sampleSize >= this.minimumWarmupSampleSize) {
      return 'warmup';
    }

    return null;
  }

  public resolveLookupStatus(snapshot: TradeCostCalibrationSnapshot | null): BuyCostCalibrationReason {
    if (!snapshot) {
      return 'missing';
    }

    if (snapshot.version !== this.calibrationVersion) {
      return 'invalid';
    }

    if (Date.now() - snapshot.updatedAt.getTime() > this.staleTtlMs) {
      return 'stale';
    }

    if (snapshot.status === 'active') {
      return 'active';
    }

    if (snapshot.status === 'warmup') {
      return 'warmup';
    }

    return 'invalid';
  }

  public async resolveBuyGateCalibration(options: {
    type: OrderTypes;
    urgency: OrderExecutionUrgency;
    estimatedCostRate: number | null;
    spreadRate: number | null;
    impactRate: number | null;
    calibrationContext?: BuyCostCalibrationContext | null;
  }): Promise<BuyCostCalibrationLookupResult> {
    const decisionNonFeeCostRate = this.resolveDecisionNonFeeCostRate(options.spreadRate, options.impactRate);
    const staticFeeComponent =
      options.estimatedCostRate != null && Number.isFinite(options.estimatedCostRate)
        ? Math.max(
            0,
            options.estimatedCostRate - Math.max(0, options.spreadRate ?? 0) - Math.max(0, options.impactRate ?? 0),
          )
        : null;

    const baseResult: BuyCostCalibrationLookupResult = {
      calibrationApplied: false,
      calibrationReason: 'missing',
      bucketKey: options.calibrationContext ? this.buildBucketKey(options.calibrationContext) : null,
      staticNonFeeCostRate: decisionNonFeeCostRate,
      rawMultiplier: null,
      appliedMultiplier: 1,
      calibratedEstimatedCostRate: options.estimatedCostRate,
    };

    if (options.type !== OrderTypes.BUY) {
      return { ...baseResult, calibrationReason: 'non_buy' };
    }

    if (options.urgency !== 'normal') {
      return { ...baseResult, calibrationReason: 'urgent' };
    }

    if (!this.isBuyGateCalibrationEnabled()) {
      return { ...baseResult, calibrationReason: 'disabled' };
    }

    if (!options.calibrationContext || decisionNonFeeCostRate == null || staticFeeComponent == null) {
      return { ...baseResult, calibrationReason: 'no_bucket' };
    }

    const snapshot = await TradeCostCalibrationSnapshot.findOne({
      where: {
        version: this.calibrationVersion,
        category: options.calibrationContext.category,
        costTier: options.calibrationContext.costTier,
        positionClass: options.calibrationContext.positionClass,
        regimeSource: options.calibrationContext.regimeSource,
      },
    });

    const calibrationReason = this.resolveLookupStatus(snapshot);
    if (!snapshot || calibrationReason !== 'active') {
      return {
        ...baseResult,
        calibrationReason,
        rawMultiplier: snapshot?.rawMultiplier ?? null,
        appliedMultiplier: snapshot?.appliedMultiplier ?? 1,
      };
    }

    const appliedMultiplier = Math.min(this.maximumAppliedMultiplier, Math.max(1, snapshot.appliedMultiplier));
    return {
      calibrationApplied: true,
      calibrationReason,
      bucketKey: this.buildBucketKey(options.calibrationContext),
      staticNonFeeCostRate: decisionNonFeeCostRate,
      rawMultiplier: snapshot.rawMultiplier,
      appliedMultiplier,
      calibratedEstimatedCostRate: staticFeeComponent + decisionNonFeeCostRate * appliedMultiplier,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  public async refreshSnapshots(): Promise<void> {
    if (!this.isBuyGateCalibrationEnabled()) {
      return;
    }

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - this.recencyWindowMs);

    try {
      const rows = await this.loadAggregationRows(windowStart);
      const groupedRows = new Map<CalibrationBucketKey, AggregationRow[]>();

      rows.forEach((row) => {
        const key = `${row.category}:${row.costTier}:${row.positionClass}:${row.regimeSource}` as CalibrationBucketKey;
        const bucketRows = groupedRows.get(key) ?? [];
        bucketRows.push(row);
        groupedRows.set(key, bucketRows);
      });

      const existingSnapshots = await TradeCostCalibrationSnapshot.find({
        where: {
          version: this.calibrationVersion,
        },
      });
      const snapshotMap = new Map<CalibrationBucketKey, TradeCostCalibrationSnapshot>();
      existingSnapshots.forEach((snapshot) => {
        const key =
          `${snapshot.category}:${snapshot.costTier}:${snapshot.positionClass}:${snapshot.regimeSource}` as CalibrationBucketKey;
        snapshotMap.set(key, snapshot);
      });

      const snapshotsToSave: TradeCostCalibrationSnapshot[] = [];
      groupedRows.forEach((bucketRows, key) => {
        const sortedRatios = bucketRows.map((row) => row.ratio).sort((a, b) => a - b);
        const rawMultiplier = this.percentile(sortedRatios, 0.75);
        const sampleSize = sortedRatios.length;
        const status = this.resolveSnapshotStatus(sampleSize, rawMultiplier);

        if (status == null || rawMultiplier == null) {
          return;
        }

        const [category, costTier, positionClass, regimeSource] = key.split(':') as [
          Category,
          'low' | 'medium' | 'high',
          'existing' | 'new',
          'live' | 'cache_fallback' | 'unavailable_risk_off',
        ];
        const { appliedMultiplier, clampApplied } = this.applyMultiplierClamp(rawMultiplier);
        const snapshot = snapshotMap.get(key) ?? new TradeCostCalibrationSnapshot();

        snapshot.version = this.calibrationVersion;
        snapshot.category = category;
        snapshot.costTier = costTier;
        snapshot.positionClass = positionClass;
        snapshot.regimeSource = regimeSource;
        snapshot.sampleSize = sampleSize;
        snapshot.windowStart = windowStart;
        snapshot.windowEnd = windowEnd;
        snapshot.lastTradeAt = new Date(Math.max(...bucketRows.map((row) => row.createdAt.getTime())));
        snapshot.rawMultiplier = rawMultiplier;
        snapshot.appliedMultiplier = appliedMultiplier;
        snapshot.clampApplied = clampApplied;
        snapshot.status = status;
        snapshotsToSave.push(snapshot);
      });

      if (snapshotsToSave.length > 0) {
        await TradeCostCalibrationSnapshot.save(snapshotsToSave);
      }

      this.logger.log(`trade cost calibration snapshots refreshed: count=${snapshotsToSave.length}`);
    } catch (error) {
      this.logger.error(`trade cost calibration snapshot refresh failed: ${this.errorService.getErrorMessage(error)}`);
    }
  }

  private async loadAggregationRows(windowStart: Date): Promise<AggregationRow[]> {
    const rawRows = await Trade.createQueryBuilder('trade')
      .leftJoin('trade.inference', 'inference')
      .select([
        'inference.category AS category',
        'trade.spreadRate AS spreadRate',
        'trade.impactRate AS impactRate',
        'trade.requestPrice AS requestPrice',
        'trade.averagePrice AS averagePrice',
        'trade.requestedAmount AS requestedAmount',
        'trade.filledAmount AS filledAmount',
        'trade.decisionPositionClass AS decisionPositionClass',
        'trade.decisionRegimeSource AS decisionRegimeSource',
        'trade.createdAt AS createdAt',
      ])
      .where('trade.type = :type', { type: OrderTypes.BUY })
      .andWhere('trade.decisionExecutionUrgency = :urgency', { urgency: 'normal' })
      .andWhere('trade.gateBypassedReason IS NULL')
      .andWhere('trade.createdAt >= :windowStart', { windowStart })
      .andWhere('trade.requestPrice IS NOT NULL')
      .andWhere('trade.averagePrice IS NOT NULL')
      .andWhere('trade.spreadRate IS NOT NULL')
      .andWhere('trade.impactRate IS NOT NULL')
      .andWhere('trade.requestedAmount IS NOT NULL')
      .andWhere('trade.filledAmount IS NOT NULL')
      .andWhere('trade.requestedAmount > 0')
      .andWhere('trade.filledAmount / trade.requestedAmount >= :fillRatio', { fillRatio: 0.8 })
      .andWhere('trade.decisionPositionClass IS NOT NULL')
      .andWhere('trade.decisionRegimeSource IS NOT NULL')
      .andWhere('inference.category IS NOT NULL')
      .getRawMany<{
        category: Category | null;
        spreadRate: number | string | null;
        impactRate: number | string | null;
        requestPrice: number | string | null;
        averagePrice: number | string | null;
        decisionPositionClass: 'existing' | 'new' | null;
        decisionRegimeSource: 'live' | 'cache_fallback' | 'unavailable_risk_off' | null;
        createdAt: Date | string;
      }>();

    return rawRows
      .map((row) => {
        const spreadRate = this.toFiniteNumber(row.spreadRate);
        const impactRate = this.toFiniteNumber(row.impactRate);
        const requestPrice = this.toFiniteNumber(row.requestPrice);
        const averagePrice = this.toFiniteNumber(row.averagePrice);
        const decisionNonFeeCostRate = this.resolveDecisionNonFeeCostRate(spreadRate, impactRate);
        const realizedAdverseDriftRate = this.resolveRealizedAdverseDriftRate(requestPrice, averagePrice);
        const ratio = this.resolveRawMultiplier(realizedAdverseDriftRate, decisionNonFeeCostRate);

        if (
          !row.category ||
          !row.decisionPositionClass ||
          !row.decisionRegimeSource ||
          decisionNonFeeCostRate == null ||
          ratio == null
        ) {
          return null;
        }

        return {
          category: row.category,
          costTier: this.resolveCostTier(decisionNonFeeCostRate),
          positionClass: row.decisionPositionClass,
          regimeSource: row.decisionRegimeSource,
          ratio,
          createdAt: new Date(row.createdAt),
        } satisfies AggregationRow;
      })
      .filter((row): row is AggregationRow => row != null);
  }

  private percentile(values: number[], percentile: number): number | null {
    if (values.length < 1) {
      return null;
    }

    if (values.length === 1) {
      return values[0];
    }

    const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1));
    return values[index] ?? null;
  }

  private toFiniteNumber(value: number | string | null): number | null {
    if (value == null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
