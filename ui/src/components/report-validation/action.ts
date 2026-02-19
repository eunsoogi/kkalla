'use server';

import { getClient } from '@/utils/api';

import { ReportType, ReportValidationItem, ReportValidationRun, ReportValidationStatus } from '@/interfaces/report-validation.interface';

interface GetReportValidationRunsParams {
  reportType?: ReportType | 'all';
  status?: ReportValidationStatus | 'all';
  limit?: number;
}

export const getReportValidationRunsAction = async (
  params: GetReportValidationRunsParams = {},
): Promise<ReportValidationRun[]> => {
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

  try {
    const { data } = await client.get<ReportValidationRun[]>('/api/v1/report-validation/runs', {
      params: query,
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const getReportValidationRunItemsAction = async (runId: string, limit = 200): Promise<ReportValidationItem[]> => {
  if (!runId) {
    return [];
  }

  const client = await getClient();

  try {
    const { data } = await client.get<ReportValidationItem[]>(`/api/v1/report-validation/runs/${runId}/items`, {
      params: {
        limit: Math.floor(limit),
      },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
