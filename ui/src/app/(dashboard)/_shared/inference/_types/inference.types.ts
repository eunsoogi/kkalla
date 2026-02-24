import { Category } from '@/enums/category.enum';
import { CursorItem, PaginatedItem } from '@/shared/types/pagination.types';

export interface AllocationAuditBadge {
  status: 'pending' | 'running' | 'completed' | 'failed';
  overallScore?: number | null;
  verdict?: 'good' | 'mixed' | 'bad' | 'invalid' | null;
  evaluatedAt?: string | Date | null;
}

export interface AllocationRecommendation {
  id: string;
  batchId: string;
  symbol: string;
  modelTargetWeight: number;
  prevModelTargetWeight?: number | null;
  intensity?: number;
  prevIntensity?: number | null;
  category: Category;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
  validation24h?: AllocationAuditBadge;
  validation72h?: AllocationAuditBadge;
}

export interface MarketSignal {
  id: string;
  batchId: string;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
  createdAt?: string;
  updatedAt?: string;
  validation24h?: AllocationAuditBadge;
  validation72h?: AllocationAuditBadge;
}

export const initialPaginatedState: PaginatedItem<any> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};

export const initialCursorState: CursorItem<any> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
