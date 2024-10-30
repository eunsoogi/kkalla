import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { ApikeyService } from './apikey.service';
import { CreateApikeyDto } from './dto/create-apikey.dto';

@Controller('api/v1/apikeys')
export class ApikeyController {
  constructor(private readonly apikeyService: ApikeyService) {}

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  create(@Req() req, @Body() createApikeyDto: CreateApikeyDto) {
    return this.apikeyService.create(req.user, createApikeyDto);
  }
}
