import { Controller, Get } from '@nestjs/common';

import { RequestInferenceDto } from './dto/request-inference.dto';
import { InferenceService } from './inference.service';

@Controller('api/v1/inference')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  request() {
    return this.inferenceService.inference(new RequestInferenceDto());
  }
}
