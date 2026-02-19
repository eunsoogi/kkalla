'use server';

import { getClient } from '@/utils/api';

import {
  ReportType,
  ReportValidationItemPage,
  ReportValidationRunPage,
  ReportValidationStatus,
} from '@/interfaces/report-validation.interface';

interface GetReportValidationRunsParams {
  reportType?: ReportType | 'all';
  status?: ReportValidationStatus | 'all';
  page?: number;
  perPage?: number;
  limit?: number;
}

interface GetReportValidationRunItemsParams {
  page?: number;
  perPage?: number;
  limit?: number;
}

export const getReportValidationRunsAction = async (
  params: GetReportValidationRunsParams = {},
): Promise<ReportValidationRunPage> => {
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

  try {
    const { data } = await client.get<ReportValidationRunPage>('/api/v1/report-validation/runs', {
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

export const getReportValidationRunItemsAction = async (
  runId: string,
  params: GetReportValidationRunItemsParams = {},
): Promise<ReportValidationItemPage> => {
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
  const query: Record<string, number> = {};

  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.limit = Math.floor(params.limit);
  }

  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.page = Math.floor(params.page);
  }

  if (typeof params.perPage === 'number' && Number.isFinite(params.perPage)) {
    query.perPage = Math.floor(params.perPage);
  }

  try {
    const { data } = await client.get<ReportValidationItemPage>(`/api/v1/report-validation/runs/${runId}/items`, {
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
