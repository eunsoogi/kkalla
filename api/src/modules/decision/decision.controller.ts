import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { CursorItem, PaginatedItem } from '../item/item.interface';
import { DecisionService } from './decision.service';
import { DecisionDto } from './dto/decision.dto';
import { GetDecisionCursorDto } from './dto/get-decision-cursor.dto';
import { GetDecisionDto } from './dto/get-decision.dto';

@Controller('/api/v1/decisions')
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  async findAll(@Req() req, @Query() params: GetDecisionDto): Promise<PaginatedItem<DecisionDto>> {
    const filters: any = {
      page: params.page,
      perPage: params.perPage,
      sortDirection: params.sortDirection,
      decision: params.decision,
    };

    if (params.mine) {
      filters.users = {
        id: req.user.id,
      };
    }

    if (params.startDate || params.endDate) {
      filters.createdAt = {};

      if (params.startDate) {
        filters.createdAt.gte = params.startDate;
      }

      if (params.endDate) {
        filters.createdAt.lte = params.endDate;
      }
    }

    const result = await this.decisionService.paginate(filters);
    return {
      ...result,
      items: result.items.map((decision) => ({
        ...decision,
        symbol: decision.inference.symbol,
      })),
    };
  }

  @Get('cursor')
  @UseGuards(GoogleTokenAuthGuard)
  async cursor(@Req() req, @Query() params: GetDecisionCursorDto): Promise<CursorItem<DecisionDto, string>> {
    const filters: any = {
      cursor: params.cursor,
      limit: params.limit,
      skip: params.skip,
      sortDirection: params.sortDirection,
      decision: params.decision,
    };

    if (params.mine) {
      filters.users = {
        id: req.user.id,
      };
    }

    if (params.startDate || params.endDate) {
      filters.createdAt = {};

      if (params.startDate) {
        filters.createdAt.gte = params.startDate;
      }

      if (params.endDate) {
        filters.createdAt.lte = params.endDate;
      }
    }

    const result = await this.decisionService.cursor(filters);
    return {
      ...result,
      items: result.items.map((decision) => ({
        ...decision,
        symbol: decision.inference.symbol,
      })),
    };
  }

  @Get(':id')
  @UseGuards(GoogleTokenAuthGuard)
  async findOne(@Param('id') id: string): Promise<DecisionDto> {
    const decision = await this.decisionService.findOne(id);
    return {
      ...decision,
      symbol: decision.inference.symbol,
    };
  }
}