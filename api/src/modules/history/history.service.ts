import { Injectable } from '@nestjs/common';

import { InferenceItem } from '../inference/inference.interface';
import { History } from './entities/history.entity';
import { HistoryItem } from './history.interface';

@Injectable()
export class HistoryService {
  public async fetchHistoryInferences(): Promise<InferenceItem[]> {
    const items = await History.find({
      order: {
        index: 'ASC',
      },
    });

    return items.map((item) => ({
      ticker: item.ticker,
      category: item.category,
      hasStock: true,
    }));
  }

  public async saveHistory(items: HistoryItem[]): Promise<History[]> {
    await History.delete({});

    return History.save(
      items.map((item) =>
        History.create({
          ticker: item.ticker,
          category: item.category,
          index: item.index,
        }),
      ),
    );
  }
}
