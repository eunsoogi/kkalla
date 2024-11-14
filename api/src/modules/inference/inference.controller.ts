import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { GetInferenceCursorDto } from './dto/get-inference-cursor.dto';
import { GetInferenceDto } from './dto/get-inference.dto';
import { PostInferenceDto } from './dto/post-inference.dto';
import { Inference } from './entities/inference.entity';
import { INFERENCE_CONFIG } from './inference.config';
import { InferenceData } from './inference.interface';
import { InferenceService } from './inference.service';

@Controller('api/v1/inferences')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public get(@Req() req, @Query() params: GetInferenceDto): Promise<PaginatedItem<Inference>> {
    return this.inferenceService.paginate({
      ...params,
      ...(Boolean(params.mine) && {
        users: {
          id: req.user.id,
        },
      }),
    });
  }

  @Get('cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public cursor(@Req() req, @Query() params: GetInferenceCursorDto): Promise<CursorItem<Inference, string>> {
    return this.inferenceService.cursor({
      ...params,
      ...(Boolean(params.mine) && {
        users: {
          id: req.user.id,
        },
      }),
    });
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public post(@Body() body: PostInferenceDto): Promise<InferenceData> {
    return this.inferenceService.inference({
      ...INFERENCE_CONFIG.message,
      ...body,
    });
  }
}
