import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '@/modules/auth/guards/google.guard';
import { User } from '@/modules/user/entities/user.entity';

import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

@Controller('api/v1/dashboard')
@UseGuards(GoogleTokenAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: User): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary(user);
  }
}
