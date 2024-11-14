import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { GetCursorDto } from '../item/dto/get-cursor.dto';
import { CursorItem, PaginatedItem } from '../item/item.interface';
import { GetNotifyDto } from './dto/get-notify.dto';
import { NotifyResponse } from './dto/notify-response.dto';
import { PostNotifyDto } from './dto/post-notify.dto';
import { NotifyService } from './notify.service';

@Controller('api/v1/notify')
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@Req() req, @Query() params: GetNotifyDto): Promise<PaginatedItem<NotifyResponse>> {
    const result = await this.notifyService.paginate(req.user, params);

    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        message: item?.message,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  @Get('cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public async cursor(@Req() req, @Query() params: GetCursorDto<string>): Promise<CursorItem<NotifyResponse, string>> {
    const result = await this.notifyService.cursor(req.user, params);

    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        message: item?.message,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
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
