import { Injectable } from '@nestjs/common';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Trade } from '../trade/entities/trade.entity';
import { User } from '../user/entities/user.entity';
import { ProfitData, ProfitFilter } from './profit.interface';

@Injectable()
export class ProfitService {
  public async getProfit(user: User): Promise<ProfitData> {
    const result = await Trade.createQueryBuilder()
      .select('SUM(profit)', 'sum')
      .where('user_id = :userId', { userId: user.id })
      .getRawOne();

    const profit = result?.sum || 0;

    return {
      email: user.email,
      profit,
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
