import { Body, Controller, Post } from '@nestjs/common';

import { ApikeyService } from './apikey.service';
import { CreateApikeyDto } from './dto/create-apikey.dto';

@Controller('api/v1/apikeys')
export class ApikeyController {
  constructor(private readonly apikeyService: ApikeyService) {}

  @Post()
  create(@Body() createApikeyDto: CreateApikeyDto) {
    return this.apikeyService.create(createApikeyDto);
  }
}
