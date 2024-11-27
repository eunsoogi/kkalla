import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { ChatPostMessageResponse } from '@slack/web-api';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { SlackConfigResponseDto } from './dto/config-response';
import { PostSlackConfigDto } from './dto/post-config.dto';
import { SendSlackMessageDto } from './dto/send-message.dto';
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
}
