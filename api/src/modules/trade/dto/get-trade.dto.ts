import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';

export class GetTradeDto extends GetPaginationDto {
  /**
   * 지정 시 최근 N시간 이내 거래만 조회 (메인 대시보드용, 예: 24)
   */
  @ApiProperty({ required: false, example: 24, description: '최근 N시간 이내 거래만 조회' })
  @Type(() => Number)
  lastHours?: number;
}
