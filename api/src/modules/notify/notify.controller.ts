import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { GetCursorDto } from '../item/dto/get-cursor.dto';
import { CursorItem, PaginatedItem } from '../item/item.interface';
import { User } from '../user/entities/user.entity';
import { GetNotifyLogDto } from './dto/get-notify-log.dto';
import { GetNotifyDto } from './dto/get-notify.dto';
import { NotifyResponse } from './dto/notify-response.dto';
import { PostNotifyDto } from './dto/post-notify.dto';
import { NotifyService } from './notify.service';

/** paginate/cursor 결과의 item을 NotifyResponse 형태로 공통 매핑할 때 사용하는 타입 */
interface NotifyItemLike {
  id: string;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Controller('api/v1/notify')
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  private toNotifyResponse(item: NotifyItemLike): NotifyResponse {
    return {
      id: item.id,
      message: item?.message,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toPaginatedResponse<T extends NotifyItemLike>(result: PaginatedItem<T>): PaginatedItem<NotifyResponse> {
    return {
      ...result,
      items: result.items.map((item) => this.toNotifyResponse(item)),
    };
  }

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@CurrentUser() user: User, @Query() params: GetNotifyDto): Promise<PaginatedItem<NotifyResponse>> {
    const result = await this.notifyService.paginate(user, params);
    return this.toPaginatedResponse(result);
  }

  /**
   * 알림 로그 테이블용 조회 (createdAt DESC, 메인 대시보드용, perPage 기본 20)
   */
  @Get('log')
  @UseGuards(GoogleTokenAuthGuard)
  public async getLog(
    @CurrentUser() user: User,
    @Query() params: GetNotifyLogDto,
  ): Promise<PaginatedItem<NotifyResponse>> {
    const effectiveParams = { ...params, perPage: params.perPage ?? 20 };
    const result = await this.notifyService.paginate(user, effectiveParams);
    return this.toPaginatedResponse(result);
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
      items: result.items.map((item) => this.toNotifyResponse(item)),
    };
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@CurrentUser() user: User, @Body() body: PostNotifyDto): Promise<NotifyResponse> {
    const result = await this.notifyService.create(user, body);
    return this.toNotifyResponse(result);
  }
}
