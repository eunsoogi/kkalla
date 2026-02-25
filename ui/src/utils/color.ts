export const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export interface GaugeSegment {
  start: number;
  end: number;
  startColor: string;
  endColor: string;
}

export const ALTCOIN_SEASON_BITCOIN_SEASON_MAX = 25;
export const ALTCOIN_SEASON_ALT_SEASON_MIN = 75;

export const BTC_DOMINANCE_ALT_FRIENDLY_MAX = 50;
export const BTC_DOMINANCE_TRANSITION_MAX = 60;

const FEARGREED_GAUGE_SEGMENTS: GaugeSegment[] = [
  {
    start: 0,
    end: 20,
    startColor: 'var(--color-regime-feargreed-segment-1-start)',
    endColor: 'var(--color-regime-feargreed-segment-1-end)',
  },
  {
    start: 20,
    end: 40,
    startColor: 'var(--color-regime-feargreed-segment-2-start)',
    endColor: 'var(--color-regime-feargreed-segment-2-end)',
  },
  {
    start: 40,
    end: 60,
    startColor: 'var(--color-regime-feargreed-segment-3-start)',
    endColor: 'var(--color-regime-feargreed-segment-3-end)',
  },
  {
    start: 60,
    end: 80,
    startColor: 'var(--color-regime-feargreed-segment-4-start)',
    endColor: 'var(--color-regime-feargreed-segment-4-end)',
  },
  {
    start: 80,
    end: 100,
    startColor: 'var(--color-regime-feargreed-segment-5-start)',
    endColor: 'var(--color-regime-feargreed-segment-5-end)',
  },
];

const BTC_DOMINANCE_GAUGE_SEGMENTS: GaugeSegment[] = [
  {
    start: 0,
    end: BTC_DOMINANCE_ALT_FRIENDLY_MAX,
    startColor: 'var(--color-regime-btc-dominance-segment-1-start)',
    endColor: 'var(--color-regime-btc-dominance-segment-1-end)',
  },
  {
    start: BTC_DOMINANCE_ALT_FRIENDLY_MAX,
    end: BTC_DOMINANCE_TRANSITION_MAX,
    startColor: 'var(--color-regime-btc-dominance-segment-2-start)',
    endColor: 'var(--color-regime-btc-dominance-segment-2-end)',
  },
  {
    start: BTC_DOMINANCE_TRANSITION_MAX,
    end: 100,
    startColor: 'var(--color-regime-btc-dominance-segment-3-start)',
    endColor: 'var(--color-regime-btc-dominance-segment-3-end)',
  },
];

const ALTCOIN_SEASON_GAUGE_SEGMENTS: GaugeSegment[] = [
  {
    start: 0,
    end: ALTCOIN_SEASON_BITCOIN_SEASON_MAX,
    startColor: 'var(--color-regime-alt-season-segment-1-start)',
    endColor: 'var(--color-regime-alt-season-segment-1-end)',
  },
  {
    start: ALTCOIN_SEASON_BITCOIN_SEASON_MAX,
    end: ALTCOIN_SEASON_ALT_SEASON_MIN,
    startColor: 'var(--color-regime-alt-season-segment-2-start)',
    endColor: 'var(--color-regime-alt-season-segment-2-end)',
  },
  {
    start: ALTCOIN_SEASON_ALT_SEASON_MIN,
    end: 100,
    startColor: 'var(--color-regime-alt-season-segment-3-start)',
    endColor: 'var(--color-regime-alt-season-segment-3-end)',
  },
];

export const getFeargreedGaugeSegments = (): GaugeSegment[] => FEARGREED_GAUGE_SEGMENTS;

export const getBtcDominanceGaugeSegments = (): GaugeSegment[] => BTC_DOMINANCE_GAUGE_SEGMENTS;

export const getAltcoinSeasonGaugeSegments = (): GaugeSegment[] => ALTCOIN_SEASON_GAUGE_SEGMENTS;

export const getDiffColor = (diff: number) => {
  return diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-500' : 'text-gray-500';
};

export const getDiffPrefix = (diff: number) => {
  return diff > 0 ? '+' : '';
};
