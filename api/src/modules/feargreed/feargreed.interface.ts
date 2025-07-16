export interface FeargreedApiResponse {
  name: string;
  data: {
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
  }[];
  metadata: {
    error: string | null;
  };
}

export interface Feargreed {
  value: number;
  classification: string;
  timestamp: number;
  date: string;
  timeUntilUpdate: number;
  diff?: number;
}

export interface CompactFeargreed {
  value: number;
  classification: string;
  timestamp: number;
}

export interface FeargreedHistory {
  data: Feargreed[];
}
