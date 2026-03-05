type TranslateFn = (key: string) => string;

const translateWithFallback = (t: TranslateFn, key: string, fallback: string): string => {
  try {
    const translated = t(key);
    return translated === key ? fallback : translated;
  } catch {
    return fallback;
  }
};

export const resolveTriggerReasonLabel = (t: TranslateFn, reason?: string | null): string => {
  if (!reason) {
    return '-';
  }

  return translateWithFallback(t, `trade.triggerReasons.${reason}`, reason);
};

export const resolveGateBypassedReasonLabel = (t: TranslateFn, reason?: string | null): string => {
  if (!reason) {
    return '-';
  }

  return translateWithFallback(t, `trade.gateBypassedReasons.${reason}`, reason);
};
