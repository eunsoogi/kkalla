import { Injectable } from '@nestjs/common';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { getStartOfTodayInOffset, parseTzOffsetHours } from '@/utils/date';

import { Trade } from '../trade/entities/trade.entity';
import { User } from '../user/entities/user.entity';
import { ProfitData, ProfitFilter } from './profit.interface';

@Injectable()
export class ProfitService {
  public async getProfit(user: User): Promise<ProfitData> {
    // 전체 누적 수익
    const totalResult = await Trade.createQueryBuilder()
      .select('SUM(profit)', 'sum')
      .where('user_id = :userId', { userId: user.id })
      .getRawOne();

    const totalProfit = Number(totalResult?.sum) || 0;

    // 오늘 기준 수익: 앱 기준 시간대(TZ_OFFSET)의 오늘 00:00 시각으로 비교 (DB UTC/로컬 구분 없이 동일 순간)
    const startOfToday = getStartOfTodayInOffset(parseTzOffsetHours(process.env.TZ_OFFSET));

    const todayResult = await Trade.createQueryBuilder()
      .select('SUM(profit)', 'sum')
      .where('user_id = :userId', { userId: user.id })
      .andWhere('created_at >= :startOfToday', { startOfToday })
      .getRawOne();

    const todayProfit = Number(todayResult?.sum) || 0;

    return {
      email: user.email,
      profit: totalProfit,
      todayProfit,
    };
  }

  public async paginate(request: ItemRequest & ProfitFilter): Promise<PaginatedItem<ProfitData>> {
    const query = Trade.createQueryBuilder('trade')
      .leftJoin('trade.user', 'user')
      .select(['user.email', 'SUM(trade.profit) as profit'])
      .groupBy('user.email');

    if (request.email) {
      query.andWhere('user.email LIKE :email', { email: `%${request.email}%` });
    }

    const totalQuery = Trade.createQueryBuilder('trade')
      .leftJoin('trade.user', 'user')
      .select('COUNT(DISTINCT user.email)', 'count');

    if (request.email) {
      totalQuery.andWhere('user.email LIKE :email', { email: `%${request.email}%` });
    }

    const total = await totalQuery.getRawOne().then((result) => Number(result.count));

    const items = await query
      .take(request.perPage)
      .skip((request.page - 1) * request.perPage)
      .getRawMany();

    return {
      items: items.map((item) => ({
        email: item.user_email,
        profit: item.profit || 0,
      })),
      total,
      page: request.page,
      perPage: request.perPage,
      totalPages: Math.ceil(total / request.perPage),
    };
  }
}
