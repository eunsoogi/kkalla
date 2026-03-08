import { Category } from '@/modules/category/category.enum';
import { OrderTypes } from '@/modules/upbit/upbit.enum';

import { TradeCostCalibrationSnapshot } from './entities/trade-cost-calibration-snapshot.entity';
import { Trade } from './entities/trade.entity';
import { TradeCostCalibrationService } from './trade-cost-calibration.service';

describe('TradeCostCalibrationService', () => {
  let service: TradeCostCalibrationService;
  const errorService = {
    getErrorMessage: jest.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
  };

  beforeEach(() => {
    service = new TradeCostCalibrationService(errorService as any);
    jest.restoreAllMocks();
    delete process.env.BUY_COST_CALIBRATION_GATE_ENABLED;
  });

  it('should resolve cost tier thresholds and clamp multipliers upward only', () => {
    expect(service.resolveCostTier(0.0009)).toBe('low');
    expect(service.resolveCostTier(0.001)).toBe('medium');
    expect(service.resolveCostTier(0.0025)).toBe('high');
    expect(service.applyMultiplierClamp(0.7)).toEqual({
      appliedMultiplier: 1,
      clampApplied: true,
    });
    expect(service.applyMultiplierClamp(1.8)).toEqual({
      appliedMultiplier: 1.5,
      clampApplied: true,
    });
  });

  it('should compute non-fee and drift multipliers safely', () => {
    expect(service.resolveDecisionNonFeeCostRate(0.0004, 0.0005)).toBeCloseTo(0.0009, 10);
    expect(service.resolveRealizedAdverseDriftRate(100, 101)).toBeCloseTo(0.01, 10);
    expect(service.resolveRealizedAdverseDriftRate(100, 99)).toBe(0);
    expect(service.resolveRawMultiplier(0.01, 0.002)).toBeNull();
    expect(service.resolveRawMultiplier(0.002, 0.001)).toBeCloseTo(2, 10);
    expect(service.resolveRawMultiplier(0.01, 0.0009)).toBeNull();
  });

  it('should resolve active, stale, and disabled lookup results', async () => {
    jest.spyOn(TradeCostCalibrationSnapshot, 'findOne').mockResolvedValue({
      version: 1,
      category: Category.COIN_MAJOR,
      costTier: 'medium',
      positionClass: 'existing',
      regimeSource: 'live',
      sampleSize: 20,
      windowStart: new Date('2026-02-01T00:00:00.000Z'),
      windowEnd: new Date('2026-03-01T00:00:00.000Z'),
      lastTradeAt: new Date(),
      rawMultiplier: 1.3,
      appliedMultiplier: 1.3,
      clampApplied: false,
      status: 'active',
      updatedAt: new Date(),
    } as any);

    const active = await service.resolveBuyGateCalibration({
      type: OrderTypes.BUY,
      urgency: 'normal',
      estimatedCostRate: 0.0015,
      spreadRate: 0.0005,
      impactRate: 0.0005,
      calibrationContext: {
        category: Category.COIN_MAJOR,
        costTier: 'medium',
        positionClass: 'existing',
        regimeSource: 'live',
      },
    });

    expect(active.calibrationApplied).toBe(true);
    expect(active.calibrationReason).toBe('active');
    expect(active.calibratedEstimatedCostRate).toBeCloseTo(0.0018, 10);

    jest.spyOn(TradeCostCalibrationSnapshot, 'findOne').mockResolvedValueOnce({
      version: 1,
      category: Category.COIN_MAJOR,
      costTier: 'medium',
      positionClass: 'existing',
      regimeSource: 'live',
      sampleSize: 20,
      windowStart: new Date('2026-02-01T00:00:00.000Z'),
      windowEnd: new Date('2026-03-01T00:00:00.000Z'),
      lastTradeAt: new Date(),
      rawMultiplier: 1.3,
      appliedMultiplier: 1.3,
      clampApplied: false,
      status: 'active',
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    } as any);

    const stale = await service.resolveBuyGateCalibration({
      type: OrderTypes.BUY,
      urgency: 'normal',
      estimatedCostRate: 0.0015,
      spreadRate: 0.0005,
      impactRate: 0.0005,
      calibrationContext: {
        category: Category.COIN_MAJOR,
        costTier: 'medium',
        positionClass: 'existing',
        regimeSource: 'live',
      },
    });

    expect(stale.calibrationApplied).toBe(false);
    expect(stale.calibrationReason).toBe('stale');

    process.env.BUY_COST_CALIBRATION_GATE_ENABLED = 'false';
    const disabled = await service.resolveBuyGateCalibration({
      type: OrderTypes.BUY,
      urgency: 'normal',
      estimatedCostRate: 0.0015,
      spreadRate: 0.0005,
      impactRate: 0.0005,
      calibrationContext: {
        category: Category.COIN_MAJOR,
        costTier: 'medium',
        positionClass: 'existing',
        regimeSource: 'live',
      },
    });

    expect(disabled.calibrationReason).toBe('disabled');
  });

  it('should refresh snapshots from recent eligible buy trades', async () => {
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(
        Array.from({ length: 20 }, (_, index) => ({
          category: Category.COIN_MAJOR,
          spreadRate: '0.0005',
          impactRate: '0.0005',
          requestPrice: '100',
          averagePrice: String(100 + (index % 4) * 0.001),
          requestedAmount: '100000',
          filledAmount: '100000',
          decisionPositionClass: 'existing',
          decisionRegimeSource: 'live',
          createdAt: new Date(`2026-03-${String((index % 9) + 1).padStart(2, '0')}T00:00:00.000Z`).toISOString(),
        })),
      ),
    };
    jest.spyOn(Trade, 'createQueryBuilder').mockReturnValue(queryBuilder as any);
    jest.spyOn(TradeCostCalibrationSnapshot, 'find').mockResolvedValue([]);
    const saveSpy = jest.spyOn(TradeCostCalibrationSnapshot, 'save').mockResolvedValue([] as any);

    await service.refreshSnapshots();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const savedSnapshots = saveSpy.mock.calls[0][0] as TradeCostCalibrationSnapshot[];
    expect(savedSnapshots).toHaveLength(1);
    expect(savedSnapshots[0].status).toBe('active');
    expect(savedSnapshots[0].sampleSize).toBe(20);
    expect(savedSnapshots[0].appliedMultiplier).toBeGreaterThanOrEqual(1);
    expect(savedSnapshots[0].appliedMultiplier).toBeLessThanOrEqual(1.5);
  });
});
