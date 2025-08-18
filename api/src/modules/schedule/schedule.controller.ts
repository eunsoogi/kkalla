import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { CreateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('api/v1/schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

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

  @Post('execute/exist-items')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_WITH_EXIST_ITEMS)
  public async executeExistItems(): Promise<void> {
    this.scheduleService.processWithExistItems();
  }

  @Post('execute/new-items')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.EXEC_SCHEDULE_WITH_NEW_ITEMS)
  public async executeNewItems(): Promise<void> {
    this.scheduleService.processWithNewItems();
  }
}
