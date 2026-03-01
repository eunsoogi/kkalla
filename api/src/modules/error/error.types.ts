export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 2단계 재시도 옵션 인터페이스
 */
export interface TwoPhaseRetryOptions {
  /** 1차 재시도 옵션 */
  firstPhase?: RetryOptions;
  /** 2차 재시도 옵션 */
  secondPhase?: RetryOptions;
}
