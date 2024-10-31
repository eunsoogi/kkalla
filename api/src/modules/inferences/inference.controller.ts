import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/interfaces/item.interface';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { GetInferenceCursorDto } from './dto/get-inference-cursor.dto';
import { GetInferenceDto } from './dto/get-inference.dto';
import { PostInferenceDto } from './dto/post-inference.dto';
import { Inference } from './entities/inference.entity';
import { INFERENCE_MESSAGE_CONFIG } from './inference.config';
import { InferenceService } from './inference.service';

@Controller('api/v1/inferences')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public get(@Req() req, @Query() params: GetInferenceDto): Promise<PaginatedItem<Inference>> {
    return this.inferenceService.paginate(req.user, params);
  }

  @Get('cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public cursor(@Req() req, @Query() params: GetInferenceCursorDto): Promise<CursorItem<Inference>> {
    return this.inferenceService.cursor(req.user, params);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public post(@Req() req, @Body() body: PostInferenceDto): Promise<Inference> {
    return this.inferenceService.inferenceAndSave(req.user, {
      ...INFERENCE_MESSAGE_CONFIG,
      ...body,
    });
  }
}
