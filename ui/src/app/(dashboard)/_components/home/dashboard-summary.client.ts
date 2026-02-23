import { DashboardSummaryResponse } from '@/app/(dashboard)/_components/home/_types/dashboard-summary.types';

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
