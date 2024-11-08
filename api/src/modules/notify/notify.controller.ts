import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { NotifyResponse } from './dto/notify-response.dto';
import { PostNotifyDto } from './dto/post-notify.dto';
import { NotifyService } from './notify.service';

@Controller('api/v1/notify')
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@Req() req) {
    const result = await this.notifyService.findAll(req.user);

    return result.map((notify) => ({
      id: notify.id,
      message: notify?.message,
      createdAt: notify.createdAt,
      updatedAt: notify.updatedAt,
    }));
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@Req() req, @Body() body: PostNotifyDto): Promise<NotifyResponse> {
    const result = await this.notifyService.create(req.user, body);

    return {
      id: result.id,
      message: result?.message,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
