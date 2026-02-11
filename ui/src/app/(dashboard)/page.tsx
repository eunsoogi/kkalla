'use client';

import React from 'react';

import { useTranslations } from 'next-intl';

import { HoldingsList, MarketReportList, NewsWidget, NotificationLogTable, TradeList24h } from '@/components/dashboard';
import { FeargreedGauge } from '@/components/feargreed/FeargreedGauge';
import { FeargreedTable } from '@/components/feargreed/FeargreedTable';
import { ProfitDashboard } from '@/components/profit/ProfitDashboard';

const Page: React.FC = () => {
  const t = useTranslations();

  return (
    <>
      <div className='grid grid-cols-12 gap-4 lg:gap-6'>
        {/* 1행: 알림 로그 */}
        <div className='min-w-0 col-span-12'>
          <NotificationLogTable />
        </div>

        {/* 2행: 수익 + 거래 */}
        <div className='min-w-0 lg:col-span-4 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0'>
            <h5 className='card-title text-dark dark:text-white px-4 mb-4 sm:px-6'>{t('trade.profit')}</h5>
            <ProfitDashboard />
          </div>
        </div>
        <div className='min-w-0 lg:col-span-8 col-span-12'>
          <TradeList24h />
        </div>

        {/* 3행: 보유 종목 (전체 너비) */}
        <div className='min-w-0 col-span-12'>
          <HoldingsList />
        </div>

        {/* 4행: 최신 마켓 리포트 (전체 너비) */}
        <div className='min-w-0 col-span-12'>
          <MarketReportList />
        </div>

        {/* 5행: 뉴스 */}
        <div className='min-w-0 col-span-12'>
          <NewsWidget />
        </div>

        {/* 6행: 공포·탐욕 지수 + 히스토리 */}
        <div className='min-w-0 lg:col-span-4 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0'>
            <h5 className='card-title text-dark dark:text-white px-4 mb-4 sm:px-6'>{t('feargreed.title')}</h5>
            <div className='px-4 sm:px-6 pb-6'>
              <FeargreedGauge />
            </div>
          </div>
        </div>
        <div className='min-w-0 lg:col-span-8 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0'>
            <div className='px-4 sm:px-6 mb-4'>
              <h5 className='card-title text-dark dark:text-white'>{t('feargreed.history')}</h5>
            </div>
            <FeargreedTable />
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
