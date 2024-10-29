import { Controller, Get, Post, Query } from '@nestjs/common';

import { FindItemDto } from '../../dto/find-item.dto';
import { PaginatedItemDto } from '../../dto/paginated-item.dto';
import { RequestInferenceDto } from './dto/request-inference.dto';
import { Inference } from './entities/inference.entity';
import { InferenceService } from './inference.service';

@Controller('api/v1/inferences')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  public get(@Query() findItemDto: FindItemDto): Promise<PaginatedItemDto<Inference>> {
    return this.inferenceService.paginate(findItemDto);
  }

  @Post()
  public request(): Promise<Inference> {
    return this.inferenceService.inferenceAndSave(new RequestInferenceDto());
  }
}
