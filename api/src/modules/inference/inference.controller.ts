import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { GetInferenceCursorDto } from './dto/get-inference-cursor.dto';
import { GetInferenceDto } from './dto/get-inference.dto';
import { InferenceDto } from './dto/inference.dto';
import { PostInferenceDto } from './dto/post-inference.dto';
import { Inference } from './entities/inference.entity';
import { INFERENCE_CONFIG } from './inference.config';
import { InferenceMessageRequest } from './inference.interface';
import { InferenceService } from './inference.service';

@Controller('api/v1/inferences')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public get(@CurrentUser() user: User, @Query() params: GetInferenceDto): Promise<PaginatedItem<Inference>> {
    const filters: any = {
      ticker: params.ticker,
      category: params.category,
      page: params.page,
      perPage: params.perPage,
      sortDirection: params.sortDirection,
    };

    if (params.startDate || params.endDate) {
      filters.createdAt = {};

      if (params.startDate) {
        filters.createdAt.gte = params.startDate;
      }

      if (params.endDate) {
        filters.createdAt.lte = params.endDate;
      }
    }

    return this.inferenceService.paginate(user, filters);
  }

  @Get('cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public async cursor(
    @CurrentUser() user: User,
    @Query() params: GetInferenceCursorDto,
  ): Promise<CursorItem<Inference, string>> {
    const filters: any = {
      cursor: params.cursor,
      limit: params.limit,
      skip: params.skip,
      ticker: params.ticker,
      category: params.category,
      sortDirection: params.sortDirection,
    };

    if (params.startDate || params.endDate) {
      filters.createdAt = {};

      if (params.startDate) {
        filters.createdAt.gte = params.startDate;
      }

      if (params.endDate) {
        filters.createdAt.lte = params.endDate;
      }
    }

    return this.inferenceService.cursor(user, filters);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@Body() body: PostInferenceDto): Promise<InferenceDto> {
    return this.inferenceService.requestAPI(<InferenceMessageRequest>{
      ...INFERENCE_CONFIG.message,
      ...body,
    });
  }
}
