import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { HoldingDto } from './dto/holding.dto';
import { HoldingsService } from './holdings.service';

/**
 * 보유 종목 API (History 테이블 기반, 사용자 매매 카테고리 설정에 따라 필터링)
 */
@Controller('api/v1/holdings')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  async getHoldings(@CurrentUser() user: User): Promise<HoldingDto[]> {
    return this.holdingsService.getHoldings(user);
  }
}
