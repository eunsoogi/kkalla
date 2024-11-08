import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { PostOpenaiConfigDto } from './dto/post-config.dto';
import { OpenaiConfig } from './entities/openai-config.entity';
import { OpenaiService } from './openai.service';

@Controller('api/v1/openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Post('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async postConfig(@Req() req, @Body() request: PostOpenaiConfigDto): Promise<OpenaiConfig> {
    return this.openaiService.createConfig(req.user, request);
  }

  @Get('status')
  @UseGuards(GoogleTokenAuthGuard)
  public async status(@Req() req): Promise<ApikeyStatus> {
    return this.openaiService.status(req.user);
  }
}
