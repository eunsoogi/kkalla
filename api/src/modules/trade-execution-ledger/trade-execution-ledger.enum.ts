export enum TradeExecutionLedgerStatus {
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  RETRYABLE_FAILED = 'retryable_failed',
  NON_RETRYABLE_FAILED = 'non_retryable_failed',
  STALE_SKIPPED = 'stale_skipped',
  DUPLICATE = 'duplicate',
}

export enum TradeExecutionModule {
  ALLOCATION = 'allocation',
  RISK = 'risk',
}
