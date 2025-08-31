import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { NotifyService } from '../notify/notify.service';
import { RetryOptions, TwoPhaseRetryOptions } from './error.interface';

@Injectable()
export class ErrorService {
  private readonly logger = new Logger(ErrorService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 60000;

  constructor(
    private readonly i18n: I18nService,
    private readonly notifyService: NotifyService,
  ) {}

  public async retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const maxRetries = options?.maxRetries || this.MAX_RETRIES;
    const retryDelay = options?.retryDelay || this.RETRY_DELAY;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        this.logger.debug(error);

        this.logger.warn(
          this.i18n.t('logging.retry.attempt', {
            args: { attempt, maxRetries },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error(this.i18n.t('logging.retry.failed'));
  }

  /**
   * unknown 타입의 error에서 안전하게 에러 메시지를 추출
   * @param error 임의의 에러 객체
   * @returns 문자열로 변환된 에러 메시지
   */
  public getErrorMessage(error: unknown): string {
    if (error === null) return 'null';
    if (error === undefined) return 'undefined';

    // Error 객체인 경우
    if (error instanceof Error) {
      return error.message;
    }

    // 객체에 message 속성이 있는 경우
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message: unknown }).message;
      return typeof message === 'string' ? message : String(message);
    }

    // 그 외의 경우 JSON으로 변환 시도
    try {
      return typeof error === 'string' ? error : JSON.stringify(error);
    } catch {
      // JSON 변환 실패 시 기본값 반환
      return String(error);
    }
  }

  /**
   * 2단계 재시도 로직 구현
   * 1차: 매우 짧은 지연으로 여러번 재시도
   * 2차: 1차가 실패할 경우 긴 지연으로 추가 재시도
   * @param operation 실행할 비동기 함수
   * @param options 재시도 옵션
   * @returns 함수 실행 결과
   */
  public async retryWithFallback<T>(operation: () => Promise<T>, options?: TwoPhaseRetryOptions): Promise<T> {
    const firstPhase = options?.firstPhase || { maxRetries: 5, retryDelay: 1000 }; // 1초 간격, 5회 기본값
    const secondPhase = options?.secondPhase || { maxRetries: 3, retryDelay: 60000 }; // 1분 간격, 3회 기본값

    try {
      // 1차 재시도: 짧은 지연, 여러번 시도
      return await this.retry(operation, firstPhase);
    } catch (firstError) {
      // unknown 타입의 firstError에서 message 가져오기
      const errorMessage = this.getErrorMessage(firstError);

      this.logger.warn(
        this.i18n.t('logging.retry.fallback', {
          args: { message: errorMessage },
        }),
      );

      try {
        // 2차 재시도: 긴 지연, 추가 시도
        return await this.retry(operation, secondPhase);
      } catch (secondError) {
        // 2차 재시도도 실패 시 서버 알림 발송
        const secondErrorMessage = this.getErrorMessage(secondError);

        await this.notifyService.notifyServer(
          this.i18n.t('notify.fallback.failed', {
            args: {
              functionName: operation.name || 'unknown',
              firstMaxRetries: firstPhase.maxRetries,
              firstRetryDelay: firstPhase.retryDelay,
              secondMaxRetries: secondPhase.maxRetries,
              secondRetryDelay: secondPhase.retryDelay,
              message: secondErrorMessage,
            },
          }),
        );

        throw secondError;
      }
    }
  }
}
