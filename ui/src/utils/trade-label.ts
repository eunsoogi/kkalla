type TranslateFn = (key: string) => string;

const toTranslationKeySegment = (value: string): string => value.replace(/[-_]+([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());

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

  return translateWithFallback(t, `trade.triggerReasons.${toTranslationKeySegment(reason)}`, reason);
};

export const resolveGateBypassedReasonLabel = (t: TranslateFn, reason?: string | null): string => {
  if (!reason) {
    return '-';
  }

  return translateWithFallback(t, `trade.gateBypassedReasons.${toTranslationKeySegment(reason)}`, reason);
};
