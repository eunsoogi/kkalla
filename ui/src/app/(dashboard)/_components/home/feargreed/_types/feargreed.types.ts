export interface Feargreed {
  value: number;
  classification: string;
  timestamp: number;
  date: string;
  timeUntilUpdate: number;
  diff?: number;
}

export interface FeargreedHistory {
  data: Feargreed[];
}

export interface CompactFeargreed {
  value: number;
  classification: string;
  timestamp: number;
}
