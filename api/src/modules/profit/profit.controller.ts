import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { PaginatedItem } from '@/modules/item/item.types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { GetProfitsDto } from './dto/get-profits.dto';
import { ProfitDto } from './dto/profit.dto';
import { ProfitService } from './profit.service';

@Controller('/api/v1/profits')
export class ProfitController {
  constructor(private readonly profitService: ProfitService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_PROFIT)
  public async get(@Query() params: GetProfitsDto): Promise<PaginatedItem<ProfitDto>> {
    return this.profitService.paginate(params);
  }

  @Get('my')
  @UseGuards(GoogleTokenAuthGuard)
  public async getProfit(@CurrentUser() user: User): Promise<ProfitDto> {
    return this.profitService.getProfit(user);
  }
}
