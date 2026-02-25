import { Seeder } from 'typeorm-extension';

import { AllocationAuditItem } from '@/modules/allocation-audit/entities/allocation-audit-item.entity';
import { AllocationAuditRun } from '@/modules/allocation-audit/entities/allocation-audit-run.entity';
import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { Category } from '@/modules/category/category.enum';
import { UserCategory } from '@/modules/category/entities/user-category.entity';
import { HoldingLedger } from '@/modules/holding-ledger/entities/holding-ledger.entity';
import { MarketSignal } from '@/modules/market-intelligence/entities/market-signal.entity';
import { Notify } from '@/modules/notify/entities/notify.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { User } from '@/modules/user/entities/user.entity';
import { generateMonotonicUlid } from '@/utils/id';

interface SeedRegimeSnapshot {
  btcDominance: number;
  altcoinIndex: number;
  marketRegimeAsOf: Date;
  marketRegimeSource: 'live';
  marketRegimeIsStale: boolean;
  feargreedIndex: number;
  feargreedClassification: string;
  feargreedTimestamp: Date;
}

const resolveFeargreedClassification = (index: number): string => {
  if (index <= 20) return 'Extreme Fear';
  if (index <= 40) return 'Fear';
  if (index < 60) return 'Neutral';
  if (index < 80) return 'Greed';
  return 'Extreme Greed';
};

const buildSeedRegimeSnapshot = (seed: number): SeedRegimeSnapshot => {
  const marketRegimeAsOf = new Date(Date.now() - seed * 30 * 60 * 1000);
  const feargreedIndex = Math.max(0, Math.min(100, 42 + (seed % 7) * 6));

  return {
    btcDominance: Number((57 - (seed % 6) * 1.8).toFixed(2)),
    altcoinIndex: Number((32 + (seed % 6) * 8.2).toFixed(2)),
    marketRegimeAsOf,
    marketRegimeSource: 'live',
    marketRegimeIsStale: seed >= 2,
    feargreedIndex,
    feargreedClassification: resolveFeargreedClassification(feargreedIndex),
    feargreedTimestamp: new Date(marketRegimeAsOf.getTime() - 5 * 60 * 1000),
  };
};

const average = (values: Array<number | null | undefined>): number | null => {
  const normalized = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length < 1) {
    return null;
  }

  return Number((normalized.reduce((sum, value) => sum + value, 0) / normalized.length).toFixed(4));
};

export class UserSeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    const email = process.env.ADMIN_EMAIL!;
    let user = await User.findOneBy({ email });

    if (!user) {
      user = new User();
      user.email = email;
    }

    const adminRole = await Role.findOneBy({ name: 'ADMIN' });
    if (adminRole) {
      user.roles = [adminRole];
    }

    await user.save();
  }
}

export class AllocationRecommendationSeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  public async run(): Promise<void> {
    await AllocationRecommendation.createQueryBuilder().delete().execute();

    for (let i = 0; i < 11; i++) {
      const batchId = generateMonotonicUlid();
      const majorPrevIntensity = i < 6 ? 0.7 + (i % 3) * 0.05 : null;
      const minorPrevIntensity = i < 4 ? -0.3 + (i % 2) * 0.1 : null;
      const regime = buildSeedRegimeSnapshot(i);

      await AllocationRecommendation.save([
        {
          id: generateMonotonicUlid(),
          batchId,
          category: Category.COIN_MAJOR,
          intensity: 0.8,
          ...(majorPrevIntensity !== null ? { prevIntensity: majorPrevIntensity } : {}),
          modelTargetWeight: 0.18,
          reason: `${i + 1}) 메이저 코인 추론 내용입니다.`,
          symbol: 'BTC/KRW',
          ...regime,
        },
        {
          id: generateMonotonicUlid(),
          batchId,
          category: Category.COIN_MINOR,
          intensity: -0.5,
          ...(minorPrevIntensity !== null ? { prevIntensity: minorPrevIntensity } : {}),
          modelTargetWeight: 0,
          reason: `${i + 1}) 마이너 코인 추론 내용입니다.`,
          symbol: 'XRP/KRW',
          ...regime,
        },
        {
          id: generateMonotonicUlid(),
          batchId,
          category: Category.NASDAQ,
          intensity: 0,
          modelTargetWeight: 0,
          reason: `${i + 1}) 나스닥 종목 추론 내용입니다.`,
          symbol: 'AAPL',
          ...regime,
        },
      ]);
    }
  }
}

export class MarketSignalSeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    await MarketSignal.createQueryBuilder().delete().execute();

    const batchId = generateMonotonicUlid();
    const regime = buildSeedRegimeSnapshot(0);

    await MarketSignal.save([
      {
        id: generateMonotonicUlid(),
        batchId,
        symbol: 'BTC/KRW',
        weight: 0.34,
        confidence: 0.88,
        reason: '1) BTC는 거래대금 우위와 추세 강도가 유지되어 상위 비중을 제안합니다.',
        recommendationPrice: 146000000,
        ...regime,
      },
      {
        id: generateMonotonicUlid(),
        batchId,
        symbol: 'ETH/KRW',
        weight: 0.27,
        confidence: 0.81,
        reason: '2) ETH는 변동성 대비 체결 강도가 양호해 분산 편입 후보로 제안합니다.',
        recommendationPrice: 5900000,
        ...regime,
      },
      {
        id: generateMonotonicUlid(),
        batchId,
        symbol: 'SOL/KRW',
        weight: 0.21,
        confidence: 0.74,
        reason: '3) SOL은 단기 모멘텀이 유지되는 구간으로 판단해 제한적 비중을 제안합니다.',
        recommendationPrice: 260000,
        ...regime,
      },
      {
        id: generateMonotonicUlid(),
        batchId,
        symbol: 'XRP/KRW',
        weight: 0.18,
        confidence: 0.69,
        reason: '4) XRP는 추세 전환 가능성을 반영해 보수적 비중을 제안합니다.',
        recommendationPrice: 900,
        ...regime,
      },
    ]);
  }
}

export class AllocationAuditSeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    await AllocationAuditItem.createQueryBuilder().delete().execute();
    await AllocationAuditRun.createQueryBuilder().delete().execute();

    const [marketSignals, allocationRecommendations] = await Promise.all([
      MarketSignal.find({
        order: { createdAt: 'DESC' },
      }),
      AllocationRecommendation.find({
        order: { createdAt: 'DESC' },
      }),
    ]);

    const latestMarketBatchId = marketSignals[0]?.batchId;
    const latestAllocationBatchId = allocationRecommendations[0]?.batchId;

    if (latestMarketBatchId) {
      const batchItems = marketSignals.filter((item) => item.batchId === latestMarketBatchId).slice(0, 6);
      await this.seedMarketAuditRun(batchItems, latestMarketBatchId);
      await this.seedPendingMarketAuditRun(batchItems.slice(0, 3), `${latestMarketBatchId}-pending`);
    }

    if (latestAllocationBatchId) {
      const batchItems = allocationRecommendations
        .filter((item) => item.batchId === latestAllocationBatchId)
        .slice(0, 6);
      await this.seedAllocationAuditRun(batchItems, latestAllocationBatchId);
      await this.seedRunningAllocationAuditRun(batchItems.slice(0, 3), `${latestAllocationBatchId}-running`);
    }
  }

  private async seedMarketAuditRun(recommendations: MarketSignal[], batchId: string): Promise<void> {
    if (recommendations.length < 1) {
      return;
    }

    const run = await AllocationAuditRun.save({
      id: generateMonotonicUlid(),
      reportType: 'market',
      sourceBatchId: batchId,
      horizonHours: 24,
      status: 'completed',
      itemCount: 0,
      completedCount: 0,
      deterministicScoreAvg: null,
      aiScoreAvg: null,
      overallScore: null,
      summary: '개발용 시드: 마켓 리포트 사후검증 결과',
      startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      error: null,
    });

    const items = recommendations.map((recommendation, index) => {
      const isFailed = index === recommendations.length - 1;
      const returnPct = isFailed ? null : Number((3.8 - index * 1.6).toFixed(2));
      const deterministicScore =
        returnPct == null ? null : Number(Math.max(0, Math.min(1, 0.58 + returnPct / 20)).toFixed(4));
      const aiScore = returnPct == null ? null : Number(Math.max(0, Math.min(1, 0.55 + returnPct / 22)).toFixed(4));
      const aiVerdict = returnPct == null ? 'invalid' : returnPct >= 2 ? 'good' : returnPct >= 0 ? 'mixed' : 'bad';

      const recommendationCreatedAt = recommendation.createdAt ?? new Date();
      const dueAt = new Date(recommendationCreatedAt.getTime() + 24 * 60 * 60 * 1000);
      const evaluatedAt = new Date(dueAt.getTime() + 10 * 60 * 1000);
      const recommendationPrice = recommendation.recommendationPrice ?? null;
      const evaluatedPrice =
        recommendationPrice != null && returnPct != null
          ? Number((recommendationPrice * (1 + returnPct / 100)).toFixed(2))
          : null;

      return {
        id: generateMonotonicUlid(),
        run,
        reportType: 'market' as const,
        sourceRecommendationId: recommendation.id,
        sourceBatchId: batchId,
        symbol: recommendation.symbol,
        horizonHours: 24,
        dueAt,
        recommendationCreatedAt,
        recommendationReason: recommendation.reason,
        recommendationConfidence: recommendation.confidence ?? null,
        recommendationWeight: recommendation.weight ?? null,
        recommendationIntensity: null,
        recommendationAction: 'buy',
        recommendationPrice,
        recommendationBtcDominance: recommendation.btcDominance ?? null,
        recommendationAltcoinIndex: recommendation.altcoinIndex ?? null,
        recommendationMarketRegimeAsOf: recommendation.marketRegimeAsOf ?? null,
        recommendationMarketRegimeSource: recommendation.marketRegimeSource ?? null,
        recommendationMarketRegimeIsStale: recommendation.marketRegimeIsStale ?? null,
        recommendationFeargreedIndex: recommendation.feargreedIndex ?? null,
        recommendationFeargreedClassification: recommendation.feargreedClassification ?? null,
        recommendationFeargreedTimestamp: recommendation.feargreedTimestamp ?? null,
        evaluatedPrice,
        returnPct,
        directionHit: returnPct == null ? null : returnPct >= 0,
        realizedTradePnl:
          returnPct == null ? null : Number((((recommendationPrice ?? 0) * returnPct) / 100).toFixed(2)),
        realizedTradeAmount: recommendationPrice ?? null,
        tradeRoiPct: returnPct,
        deterministicScore,
        aiVerdict,
        aiScore,
        aiCalibration: aiScore == null ? null : Number((aiScore - 0.5).toFixed(4)),
        aiExplanation: isFailed ? null : '개발용 시드 평가: 시장 모멘텀과 추천 근거가 대체로 정렬됨',
        nextGuardrail: isFailed ? null : '급격한 거래대금 감소 구간에서는 confidence 하향',
        status: isFailed ? 'failed' : 'completed',
        evaluatedAt,
        error: isFailed ? '개발용 시드 실패 케이스' : null,
      };
    });

    await AllocationAuditItem.save(items, { chunk: 100 });
    await this.finalizeRunSummary(run, items);
  }

  private async seedAllocationAuditRun(recommendations: AllocationRecommendation[], batchId: string): Promise<void> {
    if (recommendations.length < 1) {
      return;
    }

    const run = await AllocationAuditRun.save({
      id: generateMonotonicUlid(),
      reportType: 'allocation',
      sourceBatchId: batchId,
      horizonHours: 24,
      status: 'completed',
      itemCount: 0,
      completedCount: 0,
      deterministicScoreAvg: null,
      aiScoreAvg: null,
      overallScore: null,
      summary: '개발용 시드: 자산배분 리포트 사후검증 결과',
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      error: null,
    });

    const items = recommendations.map((recommendation, index) => {
      const returnPct = Number((1.6 - index * 1.1).toFixed(2));
      const deterministicScore = Number(Math.max(0, Math.min(1, 0.56 + returnPct / 25)).toFixed(4));
      const aiScore = Number(Math.max(0, Math.min(1, 0.54 + returnPct / 28)).toFixed(4));
      const aiVerdict = returnPct >= 1 ? 'good' : returnPct >= 0 ? 'mixed' : 'bad';

      const recommendationCreatedAt = recommendation.createdAt ?? new Date();
      const dueAt = new Date(recommendationCreatedAt.getTime() + 24 * 60 * 60 * 1000);
      const evaluatedAt = new Date(dueAt.getTime() + 15 * 60 * 1000);

      return {
        id: generateMonotonicUlid(),
        run,
        reportType: 'allocation' as const,
        sourceRecommendationId: recommendation.id,
        sourceBatchId: batchId,
        symbol: recommendation.symbol,
        horizonHours: 24,
        dueAt,
        recommendationCreatedAt,
        recommendationReason: recommendation.reason ?? null,
        recommendationConfidence: null,
        recommendationWeight: null,
        recommendationIntensity: recommendation.intensity ?? null,
        recommendationAction: recommendation.action ?? 'hold',
        recommendationPrice: null,
        recommendationBtcDominance: recommendation.btcDominance ?? null,
        recommendationAltcoinIndex: recommendation.altcoinIndex ?? null,
        recommendationMarketRegimeAsOf: recommendation.marketRegimeAsOf ?? null,
        recommendationMarketRegimeSource: recommendation.marketRegimeSource ?? null,
        recommendationMarketRegimeIsStale: recommendation.marketRegimeIsStale ?? null,
        recommendationFeargreedIndex: recommendation.feargreedIndex ?? null,
        recommendationFeargreedClassification: recommendation.feargreedClassification ?? null,
        recommendationFeargreedTimestamp: recommendation.feargreedTimestamp ?? null,
        evaluatedPrice: null,
        returnPct,
        directionHit: returnPct >= 0,
        realizedTradePnl: Number((250000 * (returnPct / 100)).toFixed(2)),
        realizedTradeAmount: 250000,
        tradeRoiPct: returnPct,
        deterministicScore,
        aiVerdict,
        aiScore,
        aiCalibration: Number((aiScore - 0.5).toFixed(4)),
        aiExplanation: '개발용 시드 평가: 목표 비중과 실제 성과가 부분적으로 정렬됨',
        nextGuardrail: '강한 하락 추세에서 no_trade 조건 강화',
        status: 'completed' as const,
        evaluatedAt,
        error: null,
      };
    });

    await AllocationAuditItem.save(items, { chunk: 100 });
    await this.finalizeRunSummary(run, items);
  }

  private async seedPendingMarketAuditRun(recommendations: MarketSignal[], batchId: string): Promise<void> {
    if (recommendations.length < 1) {
      return;
    }

    const run = await AllocationAuditRun.save({
      id: generateMonotonicUlid(),
      reportType: 'market',
      sourceBatchId: batchId,
      horizonHours: 72,
      status: 'pending',
      itemCount: recommendations.length,
      completedCount: 0,
      deterministicScoreAvg: null,
      aiScoreAvg: null,
      overallScore: null,
      summary: '개발용 시드: 대기 상태 사후검증 실행',
      startedAt: null,
      completedAt: null,
      error: null,
    });

    const items = recommendations.map((recommendation, index) => {
      const recommendationCreatedAt = recommendation.createdAt ?? new Date();
      const dueAt = new Date(Date.now() + (index + 1) * 60 * 60 * 1000);

      return {
        id: generateMonotonicUlid(),
        run,
        reportType: 'market' as const,
        sourceRecommendationId: recommendation.id,
        sourceBatchId: batchId,
        symbol: recommendation.symbol,
        horizonHours: 72,
        dueAt,
        recommendationCreatedAt,
        recommendationReason: recommendation.reason ?? null,
        recommendationConfidence: recommendation.confidence ?? null,
        recommendationWeight: recommendation.weight ?? null,
        recommendationIntensity: null,
        recommendationAction: 'buy',
        recommendationPrice: recommendation.recommendationPrice ?? null,
        recommendationBtcDominance: recommendation.btcDominance ?? null,
        recommendationAltcoinIndex: recommendation.altcoinIndex ?? null,
        recommendationMarketRegimeAsOf: recommendation.marketRegimeAsOf ?? null,
        recommendationMarketRegimeSource: recommendation.marketRegimeSource ?? null,
        recommendationMarketRegimeIsStale: recommendation.marketRegimeIsStale ?? null,
        recommendationFeargreedIndex: recommendation.feargreedIndex ?? null,
        recommendationFeargreedClassification: recommendation.feargreedClassification ?? null,
        recommendationFeargreedTimestamp: recommendation.feargreedTimestamp ?? null,
        evaluatedPrice: null,
        returnPct: null,
        directionHit: null,
        realizedTradePnl: null,
        realizedTradeAmount: null,
        tradeRoiPct: null,
        deterministicScore: null,
        aiVerdict: null,
        aiScore: null,
        aiCalibration: null,
        aiExplanation: null,
        nextGuardrail: null,
        status: 'pending' as const,
        evaluatedAt: null,
        error: null,
      };
    });

    await AllocationAuditItem.save(items, { chunk: 100 });
  }

  private async seedRunningAllocationAuditRun(
    recommendations: AllocationRecommendation[],
    batchId: string,
  ): Promise<void> {
    if (recommendations.length < 1) {
      return;
    }

    const run = await AllocationAuditRun.save({
      id: generateMonotonicUlid(),
      reportType: 'allocation',
      sourceBatchId: batchId,
      horizonHours: 72,
      status: 'running',
      itemCount: recommendations.length,
      completedCount: 0,
      deterministicScoreAvg: null,
      aiScoreAvg: null,
      overallScore: null,
      summary: '개발용 시드: 진행중 상태 사후검증 실행',
      startedAt: new Date(Date.now() - 70 * 60 * 1000),
      completedAt: null,
      error: null,
    });

    const items = recommendations.map((recommendation, index) => {
      const recommendationCreatedAt = recommendation.createdAt ?? new Date();
      const dueAt = new Date(Date.now() - (index + 1) * 30 * 60 * 1000);

      const isCompleted = index === 0;
      const isRunning = index === 1;
      const returnPct = isCompleted ? 1.2 : null;
      const deterministicScore = isCompleted ? 0.612 : null;
      const aiScore = isCompleted ? 0.588 : null;
      const evaluatedAt = isCompleted ? new Date(Date.now() - 10 * 60 * 1000) : null;

      return {
        id: generateMonotonicUlid(),
        run,
        reportType: 'allocation' as const,
        sourceRecommendationId: recommendation.id,
        sourceBatchId: batchId,
        symbol: recommendation.symbol,
        horizonHours: 72,
        dueAt,
        recommendationCreatedAt,
        recommendationReason: recommendation.reason ?? null,
        recommendationConfidence: null,
        recommendationWeight: null,
        recommendationIntensity: recommendation.intensity ?? null,
        recommendationAction: recommendation.action ?? 'hold',
        recommendationPrice: null,
        recommendationBtcDominance: recommendation.btcDominance ?? null,
        recommendationAltcoinIndex: recommendation.altcoinIndex ?? null,
        recommendationMarketRegimeAsOf: recommendation.marketRegimeAsOf ?? null,
        recommendationMarketRegimeSource: recommendation.marketRegimeSource ?? null,
        recommendationMarketRegimeIsStale: recommendation.marketRegimeIsStale ?? null,
        recommendationFeargreedIndex: recommendation.feargreedIndex ?? null,
        recommendationFeargreedClassification: recommendation.feargreedClassification ?? null,
        recommendationFeargreedTimestamp: recommendation.feargreedTimestamp ?? null,
        evaluatedPrice: null,
        returnPct,
        directionHit: returnPct == null ? null : returnPct >= 0,
        realizedTradePnl: returnPct == null ? null : Number((300000 * (returnPct / 100)).toFixed(2)),
        realizedTradeAmount: returnPct == null ? null : 300000,
        tradeRoiPct: returnPct,
        deterministicScore,
        aiVerdict: isCompleted ? 'good' : null,
        aiScore,
        aiCalibration: aiScore == null ? null : Number((aiScore - 0.5).toFixed(4)),
        aiExplanation: isCompleted ? '개발용 시드 평가: 중간 진행 결과' : null,
        nextGuardrail: isCompleted ? '추세 약화 시 비중 추가 축소' : null,
        status: isCompleted ? ('completed' as const) : isRunning ? ('running' as const) : ('pending' as const),
        evaluatedAt,
        error: null,
      };
    });

    await AllocationAuditItem.save(items, { chunk: 100 });

    const completed = items.filter((item) => item.status === 'completed');
    const deterministicScoreAvg = average(completed.map((item) => item.deterministicScore));
    const aiScoreAvg = average(completed.map((item) => item.aiScore));

    run.completedCount = completed.length;
    run.deterministicScoreAvg = deterministicScoreAvg;
    run.aiScoreAvg = aiScoreAvg;
    run.overallScore = this.calculateOverallScore(deterministicScoreAvg, aiScoreAvg);
    await AllocationAuditRun.save(run);
  }

  private async finalizeRunSummary(run: AllocationAuditRun, items: Array<Partial<AllocationAuditItem>>): Promise<void> {
    const completed = items.filter((item) => item.status === 'completed');
    const deterministicScores = completed.map((item) => item.deterministicScore);
    const aiScores = completed.map((item) => item.aiScore);
    const overallScores = completed.map((item) => {
      const deterministic = item.deterministicScore;
      const ai = item.aiScore;

      if (typeof deterministic === 'number' && typeof ai === 'number') {
        return Number((0.6 * deterministic + 0.4 * ai).toFixed(4));
      }
      if (typeof deterministic === 'number') {
        return deterministic;
      }
      if (typeof ai === 'number') {
        return ai;
      }

      return null;
    });

    run.itemCount = items.length;
    run.completedCount = completed.length;
    run.deterministicScoreAvg = average(deterministicScores);
    run.aiScoreAvg = average(aiScores);
    run.overallScore = average(overallScores);
    run.status = 'completed';
    run.error = null;

    await AllocationAuditRun.save(run);
  }

  private calculateOverallScore(deterministic: number | null, ai: number | null): number | null {
    if (typeof deterministic === 'number' && typeof ai === 'number') {
      return Number((0.6 * deterministic + 0.4 * ai).toFixed(4));
    }
    if (typeof deterministic === 'number') {
      return deterministic;
    }
    if (typeof ai === 'number') {
      return ai;
    }

    return null;
  }
}

export class TradeSeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    const users = await User.find();
    const inferences = await AllocationRecommendation.find();
    await Trade.createQueryBuilder().delete().execute();

    await Trade.save([
      {
        id: generateMonotonicUlid(),
        user: users[0],
        type: OrderTypes.BUY,
        symbol: 'BTC/KRW',
        amount: 1000000,
        profit: 100000,
        inference: inferences[0],
      },
      {
        id: generateMonotonicUlid(),
        user: users[0],
        type: OrderTypes.SELL,
        symbol: 'BTC/KRW',
        amount: 1000000,
        profit: -50000,
        inference: inferences[1],
      },
    ]);
  }
}

export class NotifySeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    const users = await User.find();
    await Notify.createQueryBuilder().delete().execute();

    await Notify.save([
      {
        id: generateMonotonicUlid(),
        user: users[0],
        message:
          '`테스트 메시지 1`입니다. *테스트 메시지 1*입니다. 테스트 메시지 1입니다. 테스트 메시지 1입니다. 테스트 메시지 1입니다.',
      },
      {
        id: generateMonotonicUlid(),
        user: users[0],
        message:
          '`테스트 메시지 2`입니다. *테스트 메시지 2*입니다. 테스트 메시지 2입니다. 테스트 메시지 2입니다. 테스트 메시지 2입니다.',
      },
    ]);
  }
}

/**
 * 보유 종목(HoldingLedger) 개발용 시드 - 대시보드 위젯에서 목록 표시용
 * 카테고리별 다양한 종목으로 매매 카테고리 필터 테스트 가능
 */
export class HoldingLedgerSeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    const users = await User.find();
    const user = users[0];
    if (!user) {
      return;
    }

    await HoldingLedger.createQueryBuilder().delete().execute();

    await HoldingLedger.save([
      // 메이저 코인
      { id: generateMonotonicUlid(), user, symbol: 'BTC/KRW', category: Category.COIN_MAJOR, index: 0 },
      { id: generateMonotonicUlid(), user, symbol: 'ETH/KRW', category: Category.COIN_MAJOR, index: 1 },
      { id: generateMonotonicUlid(), user, symbol: 'SOL/KRW', category: Category.COIN_MAJOR, index: 2 },
      // 마이너 코인
      { id: generateMonotonicUlid(), user, symbol: 'XRP/KRW', category: Category.COIN_MINOR, index: 3 },
      { id: generateMonotonicUlid(), user, symbol: 'ADA/KRW', category: Category.COIN_MINOR, index: 4 },
      { id: generateMonotonicUlid(), user, symbol: 'DOGE/KRW', category: Category.COIN_MINOR, index: 5 },
      // 나스닥
      { id: generateMonotonicUlid(), user, symbol: 'AAPL', category: Category.NASDAQ, index: 6 },
      { id: generateMonotonicUlid(), user, symbol: 'MSFT', category: Category.NASDAQ, index: 7 },
      { id: generateMonotonicUlid(), user, symbol: 'NVDA', category: Category.NASDAQ, index: 8 },
    ]);
  }
}

/**
 * 개발용 매매 카테고리 시드 - 보유 종목 위젯 필터 테스트용
 * 관리자 계정은 메이저/마이너 코인만 활성화, 나스닥 비활성화로 넣어서
 * 설정 화면에서 나스닥을 켜면 보유 종목에 AAPL 등이 보이는지 확인 가능
 */
export class UserCategorySeeder implements Seeder {
  /**
   * Runs workflow logic in the backend service workflow.
   */
  async run(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    if (!email) return;

    const user = await User.findOneBy({ email });
    if (!user) return;

    const categories = await UserCategory.find({ where: { user: { id: user.id } } });
    const existingCategories = new Set(categories.map((c) => c.category));

    const targetStates: { category: Category; enabled: boolean }[] = [
      { category: Category.COIN_MAJOR, enabled: true },
      { category: Category.COIN_MINOR, enabled: true },
      { category: Category.NASDAQ, enabled: false },
    ];

    for (const { category, enabled } of targetStates) {
      if (existingCategories.has(category)) {
        const uc = categories.find((c) => c.category === category);
        if (uc && uc.enabled !== enabled) {
          uc.enabled = enabled;
          await uc.save();
        }
      } else {
        await UserCategory.create({ user, category, enabled }).save();
      }
    }
  }
}

export const seeders = [
  UserSeeder,
  UserCategorySeeder,
  AllocationRecommendationSeeder,
  MarketSignalSeeder,
  AllocationAuditSeeder,
  TradeSeeder,
  NotifySeeder,
  HoldingLedgerSeeder,
];
