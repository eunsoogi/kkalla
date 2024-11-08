import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { ChatPostMessageResponse } from '@slack/web-api';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { SlackConfigResponseDto } from './dto/config-response';
import { PostSlackConfigDto } from './dto/post-config.dto';
import { SendSlackMessageDto } from './dto/send-message.dto';
import { SlackService } from './slack.service';

@Controller('api/v1/slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async send(@Req() req, @Body() body: SendSlackMessageDto): Promise<ChatPostMessageResponse> {
    return this.slackService.send(req.user, body);
  }

  @Get('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async getConfig(@Req() req): Promise<SlackConfigResponseDto> {
    const result = await this.slackService.readConfig(req.user);

    return {
      channel: result?.channel,
    };
  }

  @Post('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async postConfig(@Req() req, @Body() body: PostSlackConfigDto): Promise<SlackConfigResponseDto> {
    const result = await this.slackService.createConfig(req.user, body);

    return {
      channel: result?.channel,
    };
  }

  @Get('status')
  @UseGuards(GoogleTokenAuthGuard)
  public async status(@Req() req): Promise<ApikeyStatus> {
    return this.slackService.status(req.user);
  }
}
