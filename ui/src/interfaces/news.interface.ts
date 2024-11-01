import { ImportanceLevel } from '@/types/news.type';

import { CursorItem } from './item.interface';

export interface News {
  id: string;
  seq: number;
  labels: string[];
  title: string;
  source: string;
  link: string;
  importance: ImportanceLevel;
  marketAnalysis: number;
  relatedStocks: string[];
  publishedAt: string;
}

export const initialCursorState: CursorItem<News> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
