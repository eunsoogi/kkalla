export enum ScheduleExpression {
  DAILY_ALLOCATION_RECOMMENDATION_NEW = '0 35 6 * * *',
  DAILY_ALLOCATION_RECOMMENDATION_EXISTING = '0 35 0,4,8,12,16,20 * * *',
}

export const ALLOCATION_RECOMMENDATION_NEW_LOCK = {
  resourceName: 'AllocationService:executeAllocationRecommendationNew',
  compatibleResourceNames: ['RebalanceService:executeBalanceRecommendationNew'],
  duration: 3_600_000,
} as const;

export const ALLOCATION_RECOMMENDATION_EXISTING_LOCK = {
  resourceName: 'AllocationService:executeAllocationRecommendationExisting',
  compatibleResourceNames: ['RebalanceService:executeBalanceRecommendationExisting'],
  duration: 3_600_000,
} as const;
