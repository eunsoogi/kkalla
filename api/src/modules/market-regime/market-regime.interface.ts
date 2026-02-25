export type MarketRegimeSource = 'live' | 'cache_fallback';
export type BtcDominanceClassification = 'altcoin_friendly' | 'transition' | 'bitcoin_dominance';
export type AltcoinIndexClassification = 'bitcoin_season' | 'neutral' | 'altcoin_season';

export interface MarketRegimeSnapshot {
  btcDominance: number;
  btcDominanceClassification: BtcDominanceClassification;
  altcoinIndex: number;
  altcoinIndexClassification: AltcoinIndexClassification;
  feargreed: Feargreed | null;
  asOf: Date;
  source: MarketRegimeSource;
  isStale: boolean;
  staleAgeMinutes: number;
}

export interface MarketRegimeCachePayload {
  btcDominance: number;
  altcoinIndex: number;
  feargreed?: Feargreed | CompactFeargreed | null;
  asOf: string;
  source?: MarketRegimeSource;
}

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
  index: number;
  classification: string;
  timestamp: number;
  date: string;
  timeUntilUpdate: number;
  diff?: number;
}

export interface CompactFeargreed {
  index: number;
  classification: string;
  timestamp: number;
}

export interface FeargreedCachePayload {
  index: number;
  classification: string;
  timestamp: number;
  date: string;
  timeUntilUpdate: number;
  diff: number;
}
