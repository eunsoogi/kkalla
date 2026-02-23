export enum ScheduleExpression {
  DAILY_MARKET_SIGNAL = '0 0 0 * * *',
}

export const MARKET_SIGNAL_LOCK = {
  resourceName: 'MarketIntelligenceService:executeMarketSignal',
  compatibleResourceNames: ['MarketResearchService:executeMarketRecommendation'],
  duration: 88_200_000,
} as const;
