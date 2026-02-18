import { Test, TestingModule } from '@nestjs/testing';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ScheduleExecutionService } from './schedule-execution.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

describe('ScheduleController', () => {
  let controller: ScheduleController;
  let scheduleService: jest.Mocked<ScheduleService>;
  let scheduleExecutionService: jest.Mocked<ScheduleExecutionService>;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [
        {
          provide: ScheduleService,
          useValue: {
            read: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: ScheduleExecutionService,
          useValue: {
            getExecutionPlans: jest.fn(),
            executeMarketRecommendation: jest.fn(),
            executeBalanceRecommendationExisting: jest.fn(),
            executeBalanceRecommendationNew: jest.fn(),
          },
        },
      ],
    });

    moduleBuilder.overrideGuard(GoogleTokenAuthGuard).useValue({
      canActivate: jest.fn().mockReturnValue(true),
    });
    moduleBuilder.overrideGuard(PermissionGuard).useValue({
      canActivate: jest.fn().mockReturnValue(true),
    });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<ScheduleController>(ScheduleController);
    scheduleService = module.get(ScheduleService);
    scheduleExecutionService = module.get(ScheduleExecutionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should read schedule for user', async () => {
    const user = { id: 'user-1' } as any;
    scheduleService.read.mockResolvedValue({ enabled: true } as any);

    const result = await controller.get(user);

    expect(scheduleService.read).toHaveBeenCalledWith(user);
    expect(result).toEqual({ enabled: true });
  });

  it('should create schedule for user', async () => {
    const user = { id: 'user-1' } as any;
    const payload = { enabled: true } as any;
    scheduleService.create.mockResolvedValue({ enabled: true } as any);

    const result = await controller.post(user, payload);

    expect(scheduleService.create).toHaveBeenCalledWith(user, payload);
    expect(result).toEqual({ enabled: true });
  });

  it('should return execution plans', () => {
    scheduleExecutionService.getExecutionPlans.mockReturnValue([
      {
        task: 'marketRecommendation',
        cronExpression: '0 0 0 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['00:00'],
      },
    ] as any);

    const result = controller.getExecutionPlans();

    expect(scheduleExecutionService.getExecutionPlans).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('should execute market recommendation and return execution status', async () => {
    scheduleExecutionService.executeMarketRecommendation.mockResolvedValue({
      task: 'marketRecommendation',
      status: 'started',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executeMarketRecommendation();

    expect(scheduleExecutionService.executeMarketRecommendation).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('started');
  });

  it('should execute existing-item rebalance and return execution status', async () => {
    scheduleExecutionService.executeBalanceRecommendationExisting.mockResolvedValue({
      task: 'balanceRecommendationExisting',
      status: 'skipped_lock',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executeBalanceRecommendationWithExistingItems();

    expect(scheduleExecutionService.executeBalanceRecommendationExisting).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('skipped_lock');
  });

  it('should execute new-item rebalance and return execution status', async () => {
    scheduleExecutionService.executeBalanceRecommendationNew.mockResolvedValue({
      task: 'balanceRecommendationNew',
      status: 'skipped_development',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executebalanceRecommendationNewItems();

    expect(scheduleExecutionService.executeBalanceRecommendationNew).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('skipped_development');
  });
});
