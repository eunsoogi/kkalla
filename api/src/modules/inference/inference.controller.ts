import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { GetInferenceDto } from './dto/get-inference.dto';
import { PostInferenceDto } from './dto/post-inference.dto';
import { Inference } from './entities/inference.entity';
import { INFERENCE_MESSAGE_CONFIG } from './inference.config';
import { InferenceResult } from './inference.interface';
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
  public cursor(@Req() req, @Query() params: GetCursorDto<string>): Promise<CursorItem<Inference, string>> {
    return this.inferenceService.cursor(req.user, params);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public post(@Req() req, @Body() body: PostInferenceDto): Promise<InferenceResult> {
    return this.inferenceService.inference(req.user, {
      ...INFERENCE_MESSAGE_CONFIG,
      ...body,
    });
  }
}
