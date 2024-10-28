import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { ApikeyService } from './apikey.service';
import { CreateApikeyDto } from './dto/create-apikey.dto';
import { UpdateApikeyDto } from './dto/update-apikey.dto';

@Controller('api/v1/apikey')
export class ApikeyController {
  constructor(private readonly apikeyService: ApikeyService) {}

  @Post()
  create(@Body() createApikeyDto: CreateApikeyDto) {
    return this.apikeyService.create(createApikeyDto);
  }

  @Get()
  findAll() {
    return this.apikeyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.apikeyService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateApikeyDto: UpdateApikeyDto) {
    return this.apikeyService.update(+id, updateApikeyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.apikeyService.remove(+id);
  }
}
