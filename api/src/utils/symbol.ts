/**
 * KRW 마켓 심볼을 BASE/KRW 형식으로 정규화합니다.
 *
 * 예:
 * - BTC -> BTC/KRW
 * - btc/krw -> BTC/KRW
 * - KRW-BTC -> BTC/KRW
 * - BTC-USDT -> BTC/KRW
 */
export function normalizeKrwSymbol(symbol: string | null | undefined): string | null {
  if (typeof symbol !== 'string') {
    return null;
  }

  const normalized = symbol.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) {
    return null;
  }

  if (normalized.includes('/')) {
    const [left, right] = normalized.split('/', 2);
    if (!left || !right) {
      return null;
    }

    const base = left === 'KRW' ? right : left;
    return `${base}/KRW`;
  }

  if (normalized.startsWith('KRW-')) {
    const base = normalized.slice('KRW-'.length);
    return base ? `${base}/KRW` : null;
  }

  if (normalized.includes('-')) {
    const [left, right] = normalized.split('-', 2);
    if (!left || !right) {
      return null;
    }

    const base = left === 'KRW' ? right : left;
    return `${base}/KRW`;
  }

  if (/^[A-Z0-9]+$/.test(normalized)) {
    return `${normalized}/KRW`;
  }

  return null;
}
