import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { NotifyService } from '../notify/notify.service';
import { ErrorService } from './error.service';

interface I18nTranslateOptions {
  args?: Record<string, unknown>;
}

describe('ErrorService', () => {
  let service: ErrorService;
  const notifyService = {
    notifyServer: jest.fn().mockResolvedValue(undefined),
  };
  const i18nService = {
    t: jest.fn((key: string, options?: I18nTranslateOptions) => {
      void options;
      return key;
    }),
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

  it('should use explicit operationName for retry failure notifications', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      service.retryWithFallback(operation, {
        firstPhase: { maxRetries: 1, retryDelay: 0 },
        secondPhase: { maxRetries: 1, retryDelay: 0 },
        operationName: 'UpbitService.cancelOrder',
      }),
    ).rejects.toThrow('boom');

    const notifyPayloadCall = i18nService.t.mock.calls.find(([key]) => key === 'notify.retry.failed');
    expect(notifyPayloadCall).toBeDefined();
    expect(notifyPayloadCall?.[1]).toMatchObject({
      args: expect.objectContaining({
        functionName: 'UpbitService.cancelOrder',
      }),
    });
    expect(notifyService.notifyServer).toHaveBeenCalledWith('notify.retry.failed');
  });

  it('should infer operationName from caller stack when callback name is empty', async () => {
    class RetryCaller {
      constructor(private readonly errorService: ErrorService) {}

      async run(): Promise<void> {
        await this.errorService.retryWithFallback(
          async () => {
            throw new Error('boom');
          },
          {
            firstPhase: { maxRetries: 1, retryDelay: 0 },
            secondPhase: { maxRetries: 1, retryDelay: 0 },
          },
        );
      }
    }

    const caller = new RetryCaller(service);

    await expect(caller.run()).rejects.toThrow('boom');

    const notifyPayloadCall = i18nService.t.mock.calls.find(([key]) => key === 'notify.retry.failed');
    expect(notifyPayloadCall).toBeDefined();
    expect(notifyPayloadCall?.[1]).toMatchObject({
      args: expect.objectContaining({
        functionName: expect.any(String),
      }),
    });

    const functionName = (notifyPayloadCall?.[1] as { args?: { functionName?: string } } | undefined)?.args
      ?.functionName;
    expect(functionName).toBeTruthy();
    expect(functionName).not.toBe('unknown');
  });
});
