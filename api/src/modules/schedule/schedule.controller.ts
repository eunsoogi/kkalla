import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { CreateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('api/v1/schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@Req() req) {
    return this.scheduleService.read(req.user);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@Req() req, @Body() createScheduleDto: CreateScheduleDto) {
    return this.scheduleService.create(req.user, createScheduleDto);
  }
}
