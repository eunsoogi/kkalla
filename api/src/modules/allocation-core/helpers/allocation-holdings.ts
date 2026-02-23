import { Balances } from 'ccxt';

import { isKrwSymbol, isOrderableSymbol } from '@/modules/allocation-core/helpers/allocation-recommendation';

interface BuildOrderableSymbolSetOptions {
  isSymbolExist: (symbol: string) => Promise<boolean>;
  onAllCheckFailed?: () => void;
  onPartialCheck?: () => void;
}

/**
 * Builds orderable symbol set used in the allocation recommendation flow.
 * @param symbols - Asset symbol to process.
 * @param options - Configuration for the allocation recommendation flow.
 * @returns Formatted string output for the operation.
 */
export async function buildOrderableSymbolSet(
  symbols: string[],
  options: BuildOrderableSymbolSetOptions,
): Promise<Set<string> | undefined> {
  const targets = Array.from(new Set(symbols.filter((symbol) => isKrwSymbol(symbol))));
  if (targets.length < 1) {
    return new Set();
  }

  const checks = await Promise.all(
    targets.map(async (symbol) => {
      try {
        return {
          symbol,
          checked: true,
          exists: await options.isSymbolExist(symbol),
        };
      } catch {
        return { symbol, checked: false, exists: false };
      }
    }),
  );

  const checkedCount = checks.filter((check) => check.checked).length;
  if (checkedCount < 1) {
    options.onAllCheckFailed?.();
    return undefined;
  }

  if (checkedCount < checks.length) {
    options.onPartialCheck?.();
  }

  // Fail open for unchecked symbols so transient exchange errors do not freeze trading.
  return new Set(checks.filter((check) => !check.checked || check.exists).map((check) => check.symbol));
}

/**
 * Builds current weight map used in the allocation recommendation flow.
 * @param balances - Input value for balances.
 * @param totalMarketValue - Input value for total market value.
 * @param getPrice - Input value for get price.
 * @param orderableSymbols - Asset symbol to process.
 * @returns Computed numeric value for the operation.
 */
export async function buildCurrentWeightMap(
  balances: Balances,
  totalMarketValue: number,
  getPrice: (symbol: string) => Promise<number>,
  orderableSymbols?: Set<string>,
): Promise<Map<string, number>> {
  const weightMap = new Map<string, number>();

  if (!Number.isFinite(totalMarketValue) || totalMarketValue <= 0) {
    return weightMap;
  }

  const weights = await Promise.all(
    balances.info
      .filter((item) => item.currency !== item.unit_currency)
      .map(async (item) => {
        const symbol = `${item.currency}/${item.unit_currency}`;
        const tradableBalance = parseFloat(item.balance || 0);

        if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
          return { symbol, weight: 0 };
        }
        if (!isOrderableSymbol(symbol, orderableSymbols)) {
          return { symbol, weight: 0 };
        }

        try {
          const currPrice = await getPrice(symbol);
          return { symbol, weight: (tradableBalance * currPrice) / totalMarketValue };
        } catch {
          // Price API fallback: use avg_buy_price to keep weight estimation available.
          const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
          if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
            return null;
          }

          return { symbol, weight: (tradableBalance * avgBuyPrice) / totalMarketValue };
        }
      }),
  );

  for (const item of weights) {
    if (!item) {
      continue;
    }

    const { symbol, weight } = item;
    if (weight > 0) {
      weightMap.set(symbol, weight);
    }
  }

  return weightMap;
}

/**
 * Builds tradable market value map used in the allocation recommendation flow.
 * @param balances - Input value for balances.
 * @param getPrice - Input value for get price.
 * @param orderableSymbols - Asset symbol to process.
 * @returns Computed numeric value for the operation.
 */
export async function buildTradableMarketValueMap(
  balances: Balances,
  getPrice: (symbol: string) => Promise<number>,
  orderableSymbols?: Set<string>,
): Promise<Map<string, number>> {
  const marketValueMap = new Map<string, number>();

  const values = await Promise.all(
    balances.info
      .filter((item) => item.currency !== item.unit_currency)
      .map(async (item) => {
        const symbol = `${item.currency}/${item.unit_currency}`;
        const tradableBalance = parseFloat(item.balance || 0);
        if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
          return { symbol, marketValue: 0 };
        }
        if (!isOrderableSymbol(symbol, orderableSymbols)) {
          return { symbol, marketValue: 0 };
        }

        try {
          const currPrice = await getPrice(symbol);
          return { symbol, marketValue: tradableBalance * currPrice };
        } catch {
          // Keep best-effort tradable value map when live price fetch fails.
          const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
          if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
            return { symbol, marketValue: 0 };
          }

          return { symbol, marketValue: tradableBalance * avgBuyPrice };
        }
      }),
  );

  for (const { symbol, marketValue } of values) {
    if (marketValue > 0) {
      marketValueMap.set(symbol, marketValue);
    }
  }

  return marketValueMap;
}
