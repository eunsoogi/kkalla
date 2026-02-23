export function getMarketRegimeMultiplierByFearGreedValue(value: number): number {
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

export async function resolveMarketRegimeMultiplier(
  readFearGreed: () => Promise<{ value?: unknown } | null | undefined>,
): Promise<number> {
  try {
    const fearGreed = await readFearGreed();
    return getMarketRegimeMultiplierByFearGreedValue(Number(fearGreed?.value));
  } catch {
    return 1;
  }
}
