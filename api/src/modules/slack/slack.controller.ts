import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { ChatPostMessageResponse } from '@slack/web-api';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { SlackConfigResponseDto } from './dto/config-response';
import { PostSlackConfigDto } from './dto/post-config.dto';
import { SendSlackMessageDto } from './dto/send-message.dto';
import { SendServerMessageDto } from './dto/send-server-message.dto';
import { SlackService } from './slack.service';

@Controller('api/v1/slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async send(@CurrentUser() user: User, @Body() body: SendSlackMessageDto): Promise<ChatPostMessageResponse> {
    return this.slackService.send(user, body);
  }

  @Get('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async getConfig(@CurrentUser() user: User): Promise<SlackConfigResponseDto> {
    const result = await this.slackService.readConfig(user);

    return {
      channel: result?.channel,
    };
  }

  @Post('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async postConfig(
    @CurrentUser() user: User,
    @Body() body: PostSlackConfigDto,
  ): Promise<SlackConfigResponseDto> {
    const result = await this.slackService.createConfig(user, body);

    return {
      channel: result?.channel,
    };
  }

  @Get('status')
  @UseGuards(GoogleTokenAuthGuard)
  public async status(@CurrentUser() user: User): Promise<ApikeyStatus> {
    return this.slackService.status(user);
  }

  @Post('server')
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.SEND_SLACK_SERVER_MESSAGE)
  public async sendServer(@Body() body: SendServerMessageDto): Promise<ChatPostMessageResponse> {
    const fullMessage = body.context ? `${body.message}\n\n${body.context}` : body.message;

    return this.slackService.sendServer({ message: fullMessage });
  }
}
