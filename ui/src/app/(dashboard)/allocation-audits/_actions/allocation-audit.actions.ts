'use server';

import { getClient } from '@/utils/api';

import {
  AllocationAuditItemSortBy,
  AllocationAuditReportType,
  AllocationAuditItemPage,
  AllocationAuditRunSortBy,
  AllocationAuditRunPage,
  AllocationAuditSortOrder,
  AllocationAuditStatus,
} from '../_types/allocation-audit.types';

interface GetAllocationAuditRunsParams {
  reportType?: AllocationAuditReportType | 'all';
  status?: AllocationAuditStatus | 'all';
  page?: number;
  perPage?: number;
  limit?: number;
  includeSummary?: boolean;
  sortBy?: AllocationAuditRunSortBy;
  sortOrder?: AllocationAuditSortOrder;
}

interface GetAllocationAuditRunItemsParams {
  page?: number;
  perPage?: number;
  limit?: number;
  includeSummary?: boolean;
  sortBy?: AllocationAuditItemSortBy;
  sortOrder?: AllocationAuditSortOrder;
}

export const getAllocationAuditRunsAction = async (
  params: GetAllocationAuditRunsParams = {},
): Promise<AllocationAuditRunPage> => {
  const client = await getClient();
  const query: Record<string, string | number> = {};

  if (params.reportType && params.reportType !== 'all') {
    query.reportType = params.reportType;
  }

  if (params.status && params.status !== 'all') {
    query.status = params.status;
  }

  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.limit = Math.floor(params.limit);
  }

  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.page = Math.floor(params.page);
  }

  if (typeof params.perPage === 'number' && Number.isFinite(params.perPage)) {
    query.perPage = Math.floor(params.perPage);
  }

  if (params.sortBy) {
    query.sortBy = params.sortBy;
  }

  if (params.sortOrder) {
    query.sortOrder = params.sortOrder;
  }

  if (params.includeSummary) {
    query.includeSummary = 'true';
  }

  try {
    const { data } = await client.get<AllocationAuditRunPage>('/api/v1/allocation-audit/runs', {
      params: query,
    });
    if (data && Array.isArray(data.items)) {
      return data;
    }
    return {
      items: [],
      total: 0,
      page: typeof query.page === 'number' ? Number(query.page) : 1,
      perPage: typeof query.perPage === 'number' ? Number(query.perPage) : 30,
      totalPages: 0,
      success: true,
    };
  } catch {
    return {
      items: [],
      total: 0,
      page: typeof query.page === 'number' ? Number(query.page) : 1,
      perPage: typeof query.perPage === 'number' ? Number(query.perPage) : 30,
      totalPages: 0,
      success: false,
    };
  }
};

export const getAllocationAuditRunItemsAction = async (
  runId: string,
  params: GetAllocationAuditRunItemsParams = {},
): Promise<AllocationAuditItemPage> => {
  if (!runId) {
    return {
      items: [],
      total: 0,
      page: 1,
      perPage: 100,
      totalPages: 0,
      success: false,
    };
  }

  const client = await getClient();
  const query: Record<string, string | number> = {};

  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.limit = Math.floor(params.limit);
  }

  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.page = Math.floor(params.page);
  }

  if (typeof params.perPage === 'number' && Number.isFinite(params.perPage)) {
    query.perPage = Math.floor(params.perPage);
  }

  if (params.sortBy) {
    query.sortBy = params.sortBy;
  }

  if (params.sortOrder) {
    query.sortOrder = params.sortOrder;
  }

  if (params.includeSummary) {
    query.includeSummary = 'true';
  }

  try {
    const { data } = await client.get<AllocationAuditItemPage>(`/api/v1/allocation-audit/runs/${runId}/items`, {
      params: query,
    });
    if (data && Array.isArray(data.items)) {
      return data;
    }
    return {
      items: [],
      total: 0,
      page: typeof query.page === 'number' ? Number(query.page) : 1,
      perPage: typeof query.perPage === 'number' ? Number(query.perPage) : 100,
      totalPages: 0,
      success: true,
    };
  } catch {
    return {
      items: [],
      total: 0,
      page: typeof query.page === 'number' ? Number(query.page) : 1,
      perPage: typeof query.perPage === 'number' ? Number(query.perPage) : 100,
      totalPages: 0,
      success: false,
    };
  }
};
