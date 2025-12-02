import { Injectable } from '@nestjs/common';

import { RecommendationItem } from '../rebalance/rebalance.interface';
import { History } from './entities/history.entity';
import { HistoryItem } from './history.interface';

@Injectable()
export class HistoryService {
  public async fetchHistory(): Promise<RecommendationItem[]> {
    const items = await History.find({
      order: {
        index: 'ASC',
      },
    });

    return items.map((item) => ({
      symbol: item.symbol,
      category: item.category,
      hasStock: true,
    }));
  }

  public async saveHistory(items: HistoryItem[]): Promise<History[]> {
    await History.createQueryBuilder().delete().execute();

    return History.save(
      items.map((item) =>
        History.create({
          symbol: item.symbol,
          category: item.category,
          index: item.index,
        }),
      ),
    );
  }
}
