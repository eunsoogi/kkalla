import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { NotifyService } from '../notify/notify.service';
import { ErrorService } from './error.service';

describe('ErrorService', () => {
  let service: ErrorService;
  const notifyService = {
    notifyServer: jest.fn().mockResolvedValue(undefined),
  };
  const i18nService = {
    t: jest.fn((key: string) => key),
  };

  beforeEach(async () => {
    notifyService.notifyServer.mockClear();
    i18nService.t.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorService,
        {
          provide: NotifyService,
          useValue: notifyService,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
      ],
    }).compile();

    service = module.get<ErrorService>(ErrorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should stop retry immediately when error is non-retryable', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('terminal'));
    const isNonRetryable = jest.fn().mockReturnValue(true);

    await expect(
      service.retry(operation, {
        maxRetries: 5,
        retryDelay: 0,
        isNonRetryable,
      }),
    ).rejects.toThrow('terminal');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(isNonRetryable).toHaveBeenCalledTimes(1);
  });

  it('should skip fallback phase when first phase fails with non-retryable error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('terminal'));
    const isNonRetryable = jest.fn().mockReturnValue(true);

    await expect(
      service.retryWithFallback(operation, {
        firstPhase: { maxRetries: 5, retryDelay: 0 },
        secondPhase: { maxRetries: 3, retryDelay: 0 },
        isNonRetryable,
      }),
    ).rejects.toThrow('terminal');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(notifyService.notifyServer).not.toHaveBeenCalled();
  });
});
