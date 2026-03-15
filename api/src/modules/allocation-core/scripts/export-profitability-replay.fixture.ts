import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import AppDataSource from '@/databases/datasource';
import { AllocationAuditItem } from '@/modules/allocation-audit/entities/allocation-audit-item.entity';

import type { ProfitabilityReplayFixture } from '../helpers/profitability-replay';

const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '..', '__fixtures__', 'issue-874-profitability-60d.fixture.json');

const WINDOW_DAYS = 60;
const BASELINE_EQUITY = 1000;

async function exportFixture(outputPath: string): Promise<void> {
  await AppDataSource.initialize();

  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const items = await AllocationAuditItem.find({
      where: {
        status: 'completed',
      },
      order: {
        recommendationCreatedAt: 'ASC',
      },
      take: 2000,
    });

    let equity = BASELINE_EQUITY;
    const steps = items
      .filter((item) => item.recommendationCreatedAt >= since)
      .filter((item) => item.realizedTradePnl != null && item.realizedTradeAmount != null)
      .map((item) => {
        const pnlAmount = Number(item.realizedTradePnl ?? 0);
        equity += pnlAmount;

        return {
          recommendationId: item.sourceRecommendationId,
          symbol: item.symbol,
          horizonHours: item.horizonHours,
          pnlAmount,
          deployedCapital: Math.max(0, Number(item.realizedTradeAmount ?? 0)),
          turnoverNotional: Math.max(0, Number(item.realizedTradeAmount ?? 0)),
          equity,
        };
      });

    const fixture: ProfitabilityReplayFixture = {
      version: 1,
      generatedAt: new Date().toISOString(),
      windowDays: WINDOW_DAYS,
      steps,
    };

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  } finally {
    await AppDataSource.destroy();
  }
}

const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT_PATH;

exportFixture(outputPath).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
