export interface MarketRegimeFeargreed {
  index: number;
  classification: string;
  timestamp: number;
  date: string;
  timeUntilUpdate: number;
  diff?: number;
}

export type MarketRegimeBtcDominanceClassification = 'altcoin_friendly' | 'transition' | 'bitcoin_dominance';
export type MarketRegimeAltcoinIndexClassification = 'bitcoin_season' | 'neutral' | 'altcoin_season';

export interface DashboardMarketRegimeSnapshot {
  btcDominance: number;
  btcDominanceClassification: MarketRegimeBtcDominanceClassification;
  altcoinIndex: number;
  altcoinIndexClassification: MarketRegimeAltcoinIndexClassification;
  feargreed?: MarketRegimeFeargreed | null;
  asOf: string | Date;
  source: 'live' | 'cache_fallback';
  isStale: boolean;
  staleAgeMinutes: number;
}
