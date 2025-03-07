import { CursorRequest } from '@/modules/item/item.interface';

import { NewsTypes } from './news.enum';
import { ImportanceLevel } from './news.type';

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

export interface CompactNews {
  title: string;
  importance: ImportanceLevel;
  timestamp: number;
}

export interface NewsRequest extends CursorRequest<number> {
  type?: NewsTypes;
  importanceLower?: number; // 최소 중요도 필터 기준값 (기본값: 0, 모든 뉴스 표시)
}

export interface NewsApiResponse {
  docs: {
    _id: string;
    구분: number;
    분류: number;
    Site: string;
    Labels: string[];
    NewsTitle: string;
    뉴스출처: string;
    뉴스출처링크: string;
    제목: string;
    뉴스링크: string;
    중요도: number;
    시황분석: number;
    게시시간: string;
    뉴스테마상태: number;
    차트표시: number;
    차트포인트시간: string;
    뉴스차트상태: number;
    createdAt: string;
    관련종목: string[];
    seq: number;
  }[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number;
  nextPage: number;
}
