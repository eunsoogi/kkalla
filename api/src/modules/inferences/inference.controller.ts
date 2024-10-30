import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { FindItemDto } from '@/dto/find-item.dto';
import { PaginatedItemDto } from '@/dto/paginated-item.dto';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { RequestInferenceDto } from './dto/request-inference.dto';
import { Inference } from './entities/inference.entity';
import { InferenceService } from './inference.service';

@Controller('api/v1/inferences')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public get(@Req() req, @Query() findItemDto: FindItemDto): Promise<PaginatedItemDto<Inference>> {
    return this.inferenceService.paginate(req.user, findItemDto);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public request(@Req() req): Promise<Inference> {
    return this.inferenceService.inferenceAndSave(req.user, new RequestInferenceDto());
  }
}
