import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { CreateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleExecutionResponse } from './schedule-execution.interface';
import { ScheduleExecutionService } from './schedule-execution.service';
import { SchedulePlanResponse } from './schedule-plan.interface';
import { ScheduleService } from './schedule.service';

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

  @Post('execute/market-recommendation')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION)
  public async executeMarketRecommendation(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeMarketRecommendation();
  }

  @Post('execute/balance-recommendation/existing')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_EXISTING)
  public async executeBalanceRecommendationWithExistingItems(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeBalanceRecommendationExisting();
  }

  @Post('execute/balance-recommendation/new')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_NEW)
  public async executebalanceRecommendationNewItems(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeBalanceRecommendationNew();
  }

  @Post('execute/report-validation')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_REPORT_VALIDATION)
  public async executeReportValidation(): Promise<ScheduleExecutionResponse> {
    return this.scheduleExecutionService.executeReportValidation();
  }
}
