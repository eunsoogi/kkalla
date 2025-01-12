import { Injectable } from '@nestjs/common';

import { InferenceItem } from '../inference/inference.interface';
import { History } from './entities/history.entity';

@Injectable()
export class HistoryService {
  public async fetchHistoryInferences(): Promise<InferenceItem[]> {
    const items = await History.find();

    return items.map((item) => ({
      ticker: item.ticker,
      category: item.category,
      hasStock: true,
    }));
  }

  public async saveHistory(items: InferenceItem[]): Promise<History[]> {
    await History.delete({});

    return History.save(
      items.map((item) =>
        History.create({
          ticker: item.ticker,
          category: item.category,
        }),
      ),
    );
  }
}
