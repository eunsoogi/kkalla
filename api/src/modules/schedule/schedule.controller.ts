import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { CreateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleExecutionService } from './schedule-execution.service';
import {
  ScheduleExecutionResponse,
  ScheduleExecutionTask,
  ScheduleLockReleaseResponse,
  ScheduleLockStateResponse,
} from './schedule-execution.types';
import { SchedulePlanResponse } from './schedule-plan.types';
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

  /**
   * Retrieves workflow logic for the schedule execution flow.
   * @param user - User identifier related to this operation.
   * @returns Result produced by the schedule execution flow.
   */
  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@CurrentUser() user: User) {
    return this.scheduleService.read(user);
  }

  /**
   * Handles post in the schedule execution workflow.
   * @param user - User identifier related to this operation.
   * @param createScheduleDto - Input value for create schedule dto.
   * @returns Result produced by the schedule execution flow.
   */
  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@CurrentUser() user: User, @Body() createScheduleDto: CreateScheduleDto) {
    return this.scheduleService.create(user, createScheduleDto);
  }

  /**
   * Retrieves execution plans for the schedule execution flow.
   * @returns Processed collection for downstream workflow steps.
   */
  @Get('execution-plans')
  @UseGuards(GoogleTokenAuthGuard)
  public getExecutionPlans(): SchedulePlanResponse[] {
    return this.scheduleExecutionService.getExecutionPlans();
  }

  /**
   * Retrieves lock states for the schedule execution flow.
   * @param user - User identifier related to this operation.
   * @returns Processed collection for downstream workflow steps.
   */
  @Get('locks')
  @UseGuards(GoogleTokenAuthGuard)
  public async getLockStates(@CurrentUser() user: User): Promise<ScheduleLockStateResponse[]> {
    return this.scheduleExecutionService.getLockStates(this.getAuthorizedTasks(user));
  }

  /**
   * Runs release lock in the schedule execution workflow.
   * @param user - User identifier related to this operation.
   * @param taskRaw - Task identifier to execute.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
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

  /**
   * Runs market signal in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  @Post('execute/market-signal')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION)
  public async executeMarketSignal(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeMarketSignal();
  }

  /**
   * Runs allocation recommendation with existing items in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  @Post('execute/allocation-recommendation/existing')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_EXISTING)
  public async executeAllocationRecommendationWithExistingItems(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeAllocationRecommendationExisting();
  }

  /**
   * Runs allocation recommendation new items in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  @Post('execute/allocation-recommendation/new')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_NEW)
  public async executeAllocationRecommendationNewItems(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeAllocationRecommendationNew();
  }

  /**
   * Runs allocation audit in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  @Post('execute/allocation-audit')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT)
  public async executeAllocationAudit(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeAllocationAudit();
  }

  /**
   * Parses task for the schedule execution flow.
   * @param taskRaw - Task identifier to execute.
   * @returns Result produced by the schedule execution flow.
   */
  private parseTask(taskRaw: string): ScheduleExecutionTask {
    if (EXECUTION_TASKS.includes(taskRaw as ScheduleExecutionTask)) {
      return taskRaw as ScheduleExecutionTask;
    }

    throw new BadRequestException(`Unknown schedule task: ${taskRaw}`);
  }

  /**
   * Retrieves authorized tasks for the schedule execution flow.
   * @param user - User identifier related to this operation.
   * @returns Processed collection for downstream workflow steps.
   */
  private getAuthorizedTasks(user: User): ScheduleExecutionTask[] {
    const permissions = this.getUserPermissions(user);

    return EXECUTION_TASKS.filter((task) => permissions.has(TASK_PERMISSION_MAP[task]));
  }

  /**
   * Handles ensure task permission in the schedule execution workflow.
   * @param user - User identifier related to this operation.
   * @param task - Task identifier to execute.
   */
  private ensureTaskPermission(user: User, task: ScheduleExecutionTask): void {
    const permissions = this.getUserPermissions(user);
    const requiredPermission = TASK_PERMISSION_MAP[task];

    if (!permissions.has(requiredPermission)) {
      throw new ForbiddenException(`Permission denied for task: ${task}`);
    }
  }

  /**
   * Retrieves user permissions for the schedule execution flow.
   * @param user - User identifier related to this operation.
   * @returns Result produced by the schedule execution flow.
   */
  private getUserPermissions(user: User): Set<Permission> {
    const permissions = user.roles?.flatMap((role) => role.permissions ?? []) ?? [];
    return new Set(permissions);
  }
}
