import { Body, Controller, Get, Inject, Post, UseGuards, forwardRef } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { MarketResearchService } from '../market-research/market-research.service';
import { Permission } from '../permission/permission.enum';
import { RebalanceService } from '../rebalance/rebalance.service';
import { User } from '../user/entities/user.entity';
import { CreateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('api/v1/schedules')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    @Inject(forwardRef(() => MarketResearchService))
    private readonly marketResearchService: MarketResearchService,
    @Inject(forwardRef(() => RebalanceService))
    private readonly rebalanceService: RebalanceService,
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

  @Post('execute/market-recommendation')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION)
  public async executeMarketRecommendation(): Promise<void> {
    this.marketResearchService.executeMarketRecommendation();
  }

  @Post('execute/balance-recommendation/existing')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_EXISTING)
  public async executeBalanceRecommendationWithExistingItems(): Promise<void> {
    this.rebalanceService.executeBalanceRecommendationExisting();
  }

  @Post('execute/balance-recommendation/new')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_NEW)
  public async executebalanceRecommendationNewItems(): Promise<void> {
    this.rebalanceService.executeBalanceRecommendationNew();
  }
}
