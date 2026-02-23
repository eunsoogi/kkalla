import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
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
            getLockStates: jest.fn(),
            releaseLock: jest.fn(),
            executeMarketSignal: jest.fn(),
            executeAllocationRecommendationExisting: jest.fn(),
            executeAllocationRecommendationNew: jest.fn(),
            executeAllocationAudit: jest.fn(),
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
        task: 'marketSignal',
        cronExpression: '0 0 0 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['00:00'],
      },
    ] as any);

    const result = controller.getExecutionPlans();

    expect(scheduleExecutionService.getExecutionPlans).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('should return lock states for authorized tasks', async () => {
    const user = {
      roles: [{ permissions: [Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT] }],
    } as any;

    scheduleExecutionService.getLockStates.mockResolvedValue([
      {
        task: 'allocationAudit',
        locked: true,
        ttlMs: 30_000,
        checkedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any);

    const result = await controller.getLockStates(user);

    expect(scheduleExecutionService.getLockStates).toHaveBeenCalledWith(['allocationAudit']);
    expect(result).toHaveLength(1);
    expect(result[0]?.task).toBe('allocationAudit');
  });

  it('should release task lock when user has permission', async () => {
    const user = {
      roles: [{ permissions: [Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_EXISTING] }],
    } as any;

    scheduleExecutionService.releaseLock.mockResolvedValue({
      task: 'allocationRecommendationExisting',
      released: true,
      locked: false,
      releasedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.releaseLock(user, 'allocationRecommendationExisting');

    expect(scheduleExecutionService.releaseLock).toHaveBeenCalledWith('allocationRecommendationExisting');
    expect(result.released).toBe(true);
  });

  it('should throw forbidden when lock release permission is missing', async () => {
    const user = {
      roles: [{ permissions: [Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT] }],
    } as any;

    await expect(controller.releaseLock(user, 'marketSignal')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should throw bad request for unknown lock release task', async () => {
    const user = {
      roles: [{ permissions: [Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT] }],
    } as any;

    await expect(controller.releaseLock(user, 'unknownTask')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should execute market recommendation and return execution status', async () => {
    scheduleExecutionService.executeMarketSignal.mockResolvedValue({
      task: 'marketSignal',
      status: 'started',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executeMarketSignal();

    expect(scheduleExecutionService.executeMarketSignal).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('started');
  });

  it('should execute existing-item allocation and return execution status', async () => {
    scheduleExecutionService.executeAllocationRecommendationExisting.mockResolvedValue({
      task: 'allocationRecommendationExisting',
      status: 'skipped_lock',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executeAllocationRecommendationWithExistingItems();

    expect(scheduleExecutionService.executeAllocationRecommendationExisting).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('skipped_lock');
  });

  it('should execute new-item allocation and return execution status', async () => {
    scheduleExecutionService.executeAllocationRecommendationNew.mockResolvedValue({
      task: 'allocationRecommendationNew',
      status: 'started',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executeAllocationRecommendationNewItems();

    expect(scheduleExecutionService.executeAllocationRecommendationNew).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('started');
  });

  it('should execute allocation audit and return execution status', async () => {
    scheduleExecutionService.executeAllocationAudit.mockResolvedValue({
      task: 'allocationAudit',
      status: 'started',
      requestedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.executeAllocationAudit();

    expect(scheduleExecutionService.executeAllocationAudit).toHaveBeenCalledTimes(1);
    expect(result.task).toBe('allocationAudit');
    expect(result.status).toBe('started');
  });
});
