import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';

/**
 * 알림 로그 조회용 DTO. perPage 기본값 20 (대시보드 위젯용)
 */
export class GetNotifyLogDto extends GetPaginationDto {
  @Type(() => Number)
  @ApiProperty({ required: false, example: 20, description: '페이지당 개수 (기본 20)' })
  override perPage: number = 20;
}
