import { DashboardSummaryResponse } from '@/app/(dashboard)/_components/home/_types/dashboard-summary.types';

/**
 * Retrieves dashboard summary for the dashboard UI flow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getDashboardSummary = async (): Promise<DashboardSummaryResponse> => {
  const response = await fetch('/api/dashboard/summary', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard summary: ${response.status}`);
  }

  return response.json();
};
