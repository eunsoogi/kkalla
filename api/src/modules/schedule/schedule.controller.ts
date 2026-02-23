import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { CreateScheduleDto } from './dto/update-schedule.dto';
import {
  ScheduleExecutionResponse,
  ScheduleExecutionTask,
  ScheduleLockReleaseResponse,
  ScheduleLockStateResponse,
} from './schedule-execution.interface';
import { ScheduleExecutionService } from './schedule-execution.service';
import { SchedulePlanResponse } from './schedule-plan.interface';
import { ScheduleService } from './schedule.service';

const EXECUTION_TASKS: ScheduleExecutionTask[] = [
  'marketSignal',
  'allocationRecommendationExisting',
  'allocationRecommendationNew',
  'allocationAudit',
];

const TASK_PERMISSION_MAP: Record<ScheduleExecutionTask, Permission> = {
  marketSignal: Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION,
  allocationRecommendationExisting: Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_EXISTING,
  allocationRecommendationNew: Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_NEW,
  allocationAudit: Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT,
};

@Controller('api/v1/schedules')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly scheduleExecutionService: ScheduleExecutionService,
  ) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@CurrentUser() user: User) {
    return this.scheduleService.read(user);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@CurrentUser() user: User, @Body() createScheduleDto: CreateScheduleDto) {
    return this.scheduleService.create(user, createScheduleDto);
  }

  @Get('execution-plans')
  @UseGuards(GoogleTokenAuthGuard)
  public getExecutionPlans(): SchedulePlanResponse[] {
    return this.scheduleExecutionService.getExecutionPlans();
  }

  @Get('locks')
  @UseGuards(GoogleTokenAuthGuard)
  public async getLockStates(@CurrentUser() user: User): Promise<ScheduleLockStateResponse[]> {
    return this.scheduleExecutionService.getLockStates(this.getAuthorizedTasks(user));
  }

  @Post('locks/:task/release')
  @UseGuards(GoogleTokenAuthGuard)
  public async releaseLock(
    @CurrentUser() user: User,
    @Param('task') taskRaw: string,
  ): Promise<ScheduleLockReleaseResponse> {
    const task = this.parseTask(taskRaw);
    this.ensureTaskPermission(user, task);
    return this.scheduleExecutionService.releaseLock(task);
  }

  @Post('execute/market-signal')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION)
  public async executeMarketSignal(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeMarketSignal();
  }

  @Post('execute/allocation-recommendation/existing')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_EXISTING)
  public async executeAllocationRecommendationWithExistingItems(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeAllocationRecommendationExisting();
  }

  @Post('execute/allocation-recommendation/new')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_NEW)
  public async executeAllocationRecommendationNewItems(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeAllocationRecommendationNew();
  }

  @Post('execute/allocation-audit')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT)
  public async executeAllocationAudit(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeAllocationAudit();
  }

  private parseTask(taskRaw: string): ScheduleExecutionTask {
    if (EXECUTION_TASKS.includes(taskRaw as ScheduleExecutionTask)) {
      return taskRaw as ScheduleExecutionTask;
    }

    throw new BadRequestException(`Unknown schedule task: ${taskRaw}`);
  }

  private getAuthorizedTasks(user: User): ScheduleExecutionTask[] {
    const permissions = this.getUserPermissions(user);

    return EXECUTION_TASKS.filter((task) => permissions.has(TASK_PERMISSION_MAP[task]));
  }

  private ensureTaskPermission(user: User, task: ScheduleExecutionTask): void {
    const permissions = this.getUserPermissions(user);
    const requiredPermission = TASK_PERMISSION_MAP[task];

    if (!permissions.has(requiredPermission)) {
      throw new ForbiddenException(`Permission denied for task: ${task}`);
    }
  }

  private getUserPermissions(user: User): Set<Permission> {
    const permissions = user.roles?.flatMap((role) => role.permissions ?? []) ?? [];
    return new Set(permissions);
  }
}
