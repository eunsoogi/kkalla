import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { GetCursorDto } from '../item/dto/get-cursor.dto';
import { CursorItem, PaginatedItem } from '../item/item.interface';
import { User } from '../user/entities/user.entity';
import { GetNotifyDto } from './dto/get-notify.dto';
import { NotifyResponse } from './dto/notify-response.dto';
import { PostNotifyDto } from './dto/post-notify.dto';
import { NotifyService } from './notify.service';

@Controller('api/v1/notify')
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@CurrentUser() user: User, @Query() params: GetNotifyDto): Promise<PaginatedItem<NotifyResponse>> {
    const result = await this.notifyService.paginate(user, params);

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
  public async cursor(
    @CurrentUser() user: User,
    @Query() params: GetCursorDto<string>,
  ): Promise<CursorItem<NotifyResponse, string>> {
    const result = await this.notifyService.cursor(user, params);

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
  public async post(@CurrentUser() user: User, @Body() body: PostNotifyDto): Promise<NotifyResponse> {
    const result = await this.notifyService.create(user, body);

    return {
      id: result.id,
      message: result?.message,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
