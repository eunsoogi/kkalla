/**
 * Retrieves market regime multiplier by fear greed index for the allocation recommendation flow.
 * @param value - Input value for value.
 * @returns Computed numeric value for the operation.
 */
export function getMarketRegimeMultiplierByFearGreedIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value <= 20) {
    return 0.95;
  }
  if (value <= 35) {
    return 0.97;
  }
  if (value >= 80) {
    return 0.97;
  }
  if (value >= 65) {
    return 0.99;
  }

  return 1;
}

/**
 * Retrieves market regime multiplier adjustment by btc dominance/altcoin season index for the allocation recommendation flow.
 * @param btcDominance - Input value for btc dominance.
 * @param altcoinIndex - Input value for altcoin season index.
 * @returns Computed numeric value for the operation.
 */
export function getMarketRegimeMultiplierAdjustmentByMarketSignals(btcDominance: number, altcoinIndex: number): number {
  if (!Number.isFinite(btcDominance) || !Number.isFinite(altcoinIndex)) {
    return 0;
  }

  let adjustment = 0;

  // BTC dominance가 높고 알트 시즌 지수가 낮으면 전반적으로 보수적 노출.
  if (btcDominance >= 58) {
    adjustment -= 0.02;
  } else if (btcDominance <= 48) {
    adjustment += 0.01;
  }

  // 알트 강세 구간에서는 소폭 risk-on, 약세 구간에서는 소폭 risk-off.
  if (altcoinIndex >= 75) {
    adjustment += 0.02;
  } else if (altcoinIndex <= 25) {
    adjustment -= 0.02;
  }

  return Math.max(-0.03, Math.min(0.03, adjustment));
}

interface MarketRegimeReaderResult {
  btcDominance?: unknown;
  altcoinIndex?: unknown;
  feargreed?: {
    index?: unknown;
  } | null;
}

/**
 * Normalizes market regime multiplier for the allocation recommendation flow.
 * @param readMarketRegime - Input value for read market regime.
 * @returns Computed numeric value for the operation.
 */
export async function resolveMarketRegimeMultiplier(
  readMarketRegime: () => Promise<MarketRegimeReaderResult | null | undefined>,
): Promise<number> {
  try {
    const marketRegime = await readMarketRegime();
    const fearGreed = marketRegime?.feargreed;
    const baseMultiplier = getMarketRegimeMultiplierByFearGreedIndex(Number(fearGreed?.index));

    const adjustment = getMarketRegimeMultiplierAdjustmentByMarketSignals(
      Number(marketRegime?.btcDominance),
      Number(marketRegime?.altcoinIndex),
    );
    return Math.max(0.9, Math.min(1.05, baseMultiplier + adjustment));
  } catch {
    return 1;
  }
}
