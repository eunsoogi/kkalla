import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PaginatedItem } from '../item/item.interface';
import { AccumulationService } from './accumulation.service';
import { AccumulationDto } from './dto/accumulation.dto';
import { GetAccumulationDto } from './dto/get-accumulation.dto';

@Controller('/api/v1/accumulations')
export class AccumulationController {
  constructor(private readonly accumulationService: AccumulationService) {}

  @Get('all')
  @UseGuards(GoogleTokenAuthGuard)
  public async getAll(@Query() params: GetAccumulationDto): Promise<AccumulationDto[]> {
    return this.accumulationService.getAllAccumulations(params);
  }

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@Query() params: GetAccumulationDto): Promise<PaginatedItem<AccumulationDto>> {
    return this.accumulationService.getAccumulations(params);
  }
}
