import { DashboardSummaryResponse } from '@/interfaces/dashboard.interface';

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
