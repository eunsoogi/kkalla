import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { RetryOptions } from './error.interface';

@Injectable()
export class ErrorService {
  private readonly logger = new Logger(ErrorService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 60000;

  constructor(private readonly i18n: I18nService) {}

  public async retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const maxRetries = options?.maxRetries || this.MAX_RETRIES;
    const retryDelay = options?.retryDelay || this.RETRY_DELAY;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;

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
}
