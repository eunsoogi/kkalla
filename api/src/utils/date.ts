export function parseTimestamp(timestamp: string): number {
  if (/^\d+$/.test(timestamp)) {
    return parseInt(timestamp);
  }
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/** TZ_OFFSET(예: "+09:00", "-05:00")을 시간 수로 파싱. 없으면 0(UTC). */
export function parseTzOffsetHours(tzOffset: string | undefined): number {
  if (!tzOffset) return 0;
  const m = tzOffset.trim().match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h + min / 60);
}

/** 앱 기준 시간대(offsetHours)의 "오늘 00:00"에 해당하는 시각을 반환. DB UTC/로컬 구분 없이 동일 순간으로 쓸 수 있음. */
export function getStartOfTodayInOffset(tzOffsetHours: number): Date {
  const offsetMs = tzOffsetHours * 60 * 60 * 1000;
  const now = new Date();
  const localDate = new Date(now.getTime() + offsetMs);
  return new Date(
    Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 0, 0, 0, 0) - offsetMs,
  );
}
