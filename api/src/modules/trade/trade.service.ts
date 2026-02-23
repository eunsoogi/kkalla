import { Injectable } from '@nestjs/common';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';
import { TradeFilter } from './trade.interface';

/**
 * 거래 조회 전용 서비스.
 *
 * - 거래 실행 로직은 Allocation 및 Volatility 모듈로 이동됨
 * - 거래 조회 기능만 제공 (페이지네이션 및 커서 기반 조회)
 */
@Injectable()
export class TradeService {
  /**
   * 거래 목록 페이지네이션 조회
   *
   * @param user 사용자
   * @param request 페이지네이션 요청
   * @returns 페이지네이션된 거래 목록
   */
  public async paginateTrades(user: User, request: ItemRequest & TradeFilter): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }

  /**
   * 거래 목록 커서 기반 조회
   *
   * @param user 사용자
   * @param request 커서 페이지네이션 요청 및 필터
   * @returns 커서 페이지네이션된 거래 목록
   */
  public async cursorTrades(
    user: User,
    request: CursorRequest<string> & TradeFilter,
  ): Promise<CursorItem<Trade, string>> {
    return Trade.cursor(user, request);
  }
}
