'use client';
import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { getDashboardSummary } from '@/app/(dashboard)/_components/home/dashboard-summary.client';
import { HoldingsList, MarketReportList, NewsWidget, TradeList24h } from '@/app/(dashboard)/_components/home';
import { FeargreedGauge } from '@/app/(dashboard)/_components/home/feargreed/FeargreedGauge';
import { FeargreedTable } from '@/app/(dashboard)/_components/home/feargreed/FeargreedTable';
import { ProfitDashboard } from '@/app/(dashboard)/_shared/profit/_components/ProfitDashboard';

/**
 * Renders the Page UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const Page: React.FC = () => {
  const t = useTranslations();
  const { data, isPending } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    staleTime: 30_000,
  });

  const marketReports = data?.marketReports ?? [];
  const news = data?.news ?? [];
  const feargreed = data?.feargreed ?? null;
  const feargreedHistory = data?.feargreedHistory ?? { data: [] };
  const holdings = data?.holdings ?? [];
  const trades24h = data?.trades24h ?? [];
  const profit = data?.profit ?? null;

  return (
    <>
      <div className='grid grid-cols-12 gap-4 lg:gap-6'>
        {/* 1행: 수익 + 거래 */}
        <div className='min-w-0 lg:col-span-4 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0'>
            <h5 className='card-title text-dark dark:text-white px-4 mb-4 sm:px-6'>{t('trade.profit')}</h5>
            <ProfitDashboard isLoading={isPending} profit={profit?.profit} todayProfit={profit?.todayProfit} />
          </div>
        </div>
        <div className='min-w-0 lg:col-span-8 col-span-12'>
          <TradeList24h isLoading={isPending} items={trades24h} />
        </div>

        {/* 2행: 보유 종목 (전체 너비) */}
        <div className='min-w-0 col-span-12'>
          <HoldingsList isLoading={isPending} items={holdings} />
        </div>

        {/* 3행: 최신 마켓 리포트 (전체 너비) */}
        <div className='min-w-0 col-span-12'>
          <MarketReportList isLoading={isPending} items={marketReports} />
        </div>

        {/* 4행: 뉴스 */}
        <div className='min-w-0 col-span-12'>
          <NewsWidget isLoading={isPending} items={news} />
        </div>

        {/* 5행: 공포·탐욕 지수 + 히스토리 */}
        <div className='min-w-0 lg:col-span-4 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0'>
            <h5 className='card-title text-dark dark:text-white px-4 mb-4 sm:px-6'>{t('feargreed.title')}</h5>
            <div className='px-4 sm:px-6 pb-6'>
              <FeargreedGauge isLoading={isPending} item={feargreed} />
            </div>
          </div>
        </div>
        <div className='min-w-0 lg:col-span-8 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0'>
            <div className='px-4 sm:px-6 mb-4'>
              <h5 className='card-title text-dark dark:text-white'>{t('feargreed.history')}</h5>
            </div>
            <FeargreedTable isLoading={isPending} history={feargreedHistory} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
