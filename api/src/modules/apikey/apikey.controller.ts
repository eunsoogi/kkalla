import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { ApikeyStatus } from './apikey.enum';
import { ApikeyService } from './apikey.service';
import { CreateApikeyDto } from './dto/create-apikey.dto';
import { GetApikeyStatusDto } from './dto/get-apikey-status.dto';
import { Apikey } from './entities/apikey.entity';

@Controller('api/v1/apikeys')
export class ApikeyController {
  constructor(private readonly apikeyService: ApikeyService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  get(@Req() req, @Query() request: GetApikeyStatusDto): Promise<ApikeyStatus> {
    return this.apikeyService.status(req.user, request);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  post(@Req() req, @Body() request: CreateApikeyDto): Promise<Apikey> {
    return this.apikeyService.create(req.user, request);
  }
}
