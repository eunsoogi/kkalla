export function parseTimestamp(timestamp: string): number {
  if (/^\d+$/.test(timestamp)) {
    return parseInt(timestamp);
  }
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}
