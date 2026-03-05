export type NonRetryablePredicate = (error: unknown) => boolean;

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  isNonRetryable?: NonRetryablePredicate;
}

/**
 * 2단계 재시도 옵션 인터페이스
 */
export interface TwoPhaseRetryOptions {
  /** 1차 재시도 옵션 */
  firstPhase?: RetryOptions;
  /** 2차 재시도 옵션 */
  secondPhase?: RetryOptions;
  /** 재시도하면 안 되는 오류 판별 함수 */
  isNonRetryable?: NonRetryablePredicate;
}
