import { Controller, Get, Post, Query } from '@nestjs/common';

import { FindInferenceDto } from './dto/find-inference.dto';
import { PaginatedInferenceDto } from './dto/paginated-inference.dto';
import { RequestInferenceDto } from './dto/request-inference.dto';
import { Inference } from './entities/inference.entity';
import { InferenceService } from './inference.service';

@Controller('api/v1/inference')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  public get(@Query() findInferenceDto: FindInferenceDto): Promise<PaginatedInferenceDto> {
    return this.inferenceService.paginate(findInferenceDto);
  }

  @Post()
  public request(): Promise<Inference> {
    return this.inferenceService.inferenceAndSave(new RequestInferenceDto());
  }
}
