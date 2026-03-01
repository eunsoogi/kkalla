/**
 * Allocation/MarketRisk 서비스가 공유하는 모델 신호 및 거래 정책 기본값.
 */
export const SHARED_REBALANCE_POLICY = {
  minimumTradeIntensity: 0,
  aiSignalWeight: 0.7,
  featureSignalWeight: 0.3,
  featureConfidenceWeight: 0.3,
  featureMomentumWeight: 0.25,
  featureLiquidityWeight: 0.2,
  featureVolatilityWeight: 0.15,
  featureStabilityWeight: 0.1,
  volatilityReference: 0.12,
  sellScoreThreshold: 0.6,
  minAllocationBand: 0.01,
  allocationBandRatio: 0.1,
  estimatedFeeRate: 0.0005,
  estimatedSlippageRate: 0.001,
  edgeRiskBufferRate: 0.0005,
  stagedExitLight: -0.25,
  stagedExitMedium: -0.5,
  stagedExitFull: -1,
  payoffOverlayStopLossMin: -0.5,
  payoffOverlayTrailingMin: -0.3,
  minAllocationConfidence: 0.35,
} as const;

/**
 * Allocation/MarketRisk 서비스가 공유하는 비동기 거래 실행 런타임 기본값.
 */
export const SHARED_TRADE_EXECUTION_RUNTIME = {
  queueMessageVersion: 2 as const,
  messageTtlMs: 30 * 60 * 1000,
  userTradeLockDurationMs: 5 * 60 * 1000,
  processingHeartbeatIntervalMs: 60 * 1000,
} as const;
