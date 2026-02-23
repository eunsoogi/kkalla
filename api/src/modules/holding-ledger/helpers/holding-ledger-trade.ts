import { Category } from '@/modules/category/category.enum';

interface ExecutionRequestLike {
  symbol: string;
  diff: number;
  inference?: {
    category: Category;
  };
}

interface ExecutionTradeLike {
  type: string;
}

interface HoldingLedgerRemoveItem {
  symbol: string;
  category: Category;
}

interface HoldingLedgerSaveItem {
  symbol: string;
  category: Category;
  index: number;
}

/**
 * Transforms executed buy holding items for the holding ledger flow.
 * @param executions - Input value for executions.
 * @param buyOrderType - Input value for buy order type.
 * @returns Processed collection for downstream workflow steps.
 */
export function collectExecutedBuyHoldingItems<
  TExecution extends {
    request: ExecutionRequestLike;
    trade: ExecutionTradeLike | null;
  },
>(executions: TExecution[], buyOrderType: string): HoldingLedgerRemoveItem[] {
  // Key by symbol/category so repeated fills collapse into a single holding entry.
  const boughtMap = new Map<string, HoldingLedgerRemoveItem>();

  executions.forEach(({ request, trade }) => {
    if (!trade || !request.inference || trade.type !== buyOrderType) {
      return;
    }

    const key = `${request.symbol}:${request.inference.category}`;
    boughtMap.set(key, {
      symbol: request.symbol,
      category: request.inference.category,
    });
  });

  return Array.from(boughtMap.values());
}

/**
 * Transforms liquidated holding items for the holding ledger flow.
 * @param executions - Input value for executions.
 * @param sellOrderType - Input value for sell order type.
 * @param existingHoldings - Input value for existing holdings.
 * @returns Processed collection for downstream workflow steps.
 */
export function collectLiquidatedHoldingItems<
  TExecution extends {
    request: ExecutionRequestLike;
    trade: ExecutionTradeLike | null;
  },
  TExistingHoldingItem extends HoldingLedgerRemoveItem,
>(
  executions: TExecution[],
  sellOrderType: string,
  existingHoldings?: TExistingHoldingItem[],
): HoldingLedgerRemoveItem[] {
  const removedMap = new Map<string, HoldingLedgerRemoveItem>();
  const categoryBySymbol = new Map<string, Set<Category>>();

  existingHoldings?.forEach((item) => {
    const categories = categoryBySymbol.get(item.symbol) ?? new Set<Category>();
    categories.add(item.category);
    categoryBySymbol.set(item.symbol, categories);
  });

  executions.forEach(({ request, trade }) => {
    if (!trade || trade.type !== sellOrderType) {
      return;
    }

    // diff = -1 인 경우를 "전량 매도"로 간주해 자산 배분 보유 원장에서 제거한다.
    if (request.diff > -1 + Number.EPSILON) {
      return;
    }

    if (request.inference) {
      const key = `${request.symbol}:${request.inference.category}`;
      removedMap.set(key, {
        symbol: request.symbol,
        category: request.inference.category,
      });
      return;
    }

    // Legacy queue items may miss inference; infer categories from existing holdings.
    const categories = categoryBySymbol.get(request.symbol);
    if (!categories || categories.size < 1) {
      return;
    }

    categories.forEach((category) => {
      const key = `${request.symbol}:${category}`;
      removedMap.set(key, {
        symbol: request.symbol,
        category,
      });
    });
  });

  return Array.from(removedMap.values());
}

/**
 * Builds merged holdings for save used in the holding ledger flow.
 * @param existingHoldings - Input value for existing holdings.
 * @param liquidatedItems - Collection of items used by the holding ledger flow.
 * @param executedBuyItems - Collection of items used by the holding ledger flow.
 * @returns Processed collection for downstream workflow steps.
 */
export function buildMergedHoldingsForSave<T extends HoldingLedgerRemoveItem>(
  existingHoldings: T[],
  liquidatedItems: HoldingLedgerRemoveItem[],
  executedBuyItems: HoldingLedgerRemoveItem[],
): HoldingLedgerSaveItem[] {
  // Remove liquidated pairs first, then overlay newly bought pairs for final ledger snapshot.
  const removedKeySet = new Set(liquidatedItems.map((item) => `${item.symbol}:${item.category}`));
  const merged = new Map<string, HoldingLedgerRemoveItem>();

  existingHoldings.forEach((item) => {
    const key = `${item.symbol}:${item.category}`;
    if (!removedKeySet.has(key)) {
      merged.set(key, item);
    }
  });

  executedBuyItems.forEach((item) => {
    const key = `${item.symbol}:${item.category}`;
    if (!removedKeySet.has(key)) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values()).map((item, index) => ({
    symbol: item.symbol,
    category: item.category,
    index,
  }));
}
