'use client';
import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { getDashboardSummary } from '@/app/(dashboard)/_components/home/dashboard-summary.client';
import {
  FeargreedWidget,
  HoldingsList,
  MarketRegimeWidget,
  MarketReportList,
  NewsWidget,
  TradeList24h,
} from '@/app/(dashboard)/_components/home';
import { ProfitDashboard } from '@/app/(dashboard)/_shared/profit/_components/ProfitDashboard';

/**
 * Resolves BTC dominance state label for the dashboard UI.
 * @param t - Translator.
 * @param classification - Snapshot classification value.
 * @returns Localized label for the current BTC dominance state.
 */
const resolveBtcDominanceStateLabel = (
  t: (key: string) => string,
  classification?: 'altcoin_friendly' | 'transition' | 'bitcoin_dominance' | null,
): string => {
  switch (classification) {
    case 'altcoin_friendly':
      return t('dashboard.marketRegimeStateBtcAltFriendly');
    case 'transition':
      return t('dashboard.marketRegimeStateBtcTransition');
    case 'bitcoin_dominance':
      return t('dashboard.marketRegimeStateBtcDominant');
    default:
      return '-';
  }
};

/**
 * Resolves altcoin season state label for the dashboard UI.
 * @param t - Translator.
 * @param classification - Snapshot classification value.
 * @returns Localized label for the current altcoin season state.
 */
const resolveAltcoinSeasonStateLabel = (
  t: (key: string) => string,
  classification?: 'bitcoin_season' | 'neutral' | 'altcoin_season' | null,
): string => {
  switch (classification) {
    case 'bitcoin_season':
      return t('dashboard.marketRegimeStateAltBitcoinSeason');
    case 'neutral':
      return t('dashboard.marketRegimeStateAltNeutral');
    case 'altcoin_season':
      return t('dashboard.marketRegimeStateAltSeason');
    default:
      return '-';
  }
};

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
  const marketRegime = data?.marketRegime ?? null;
  const news = data?.news ?? [];
  const feargreed = marketRegime?.feargreed ?? null;
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

        {/* 5행: BTC 도미넌스 + 알트코인 시즌 지수 + 공포·탐욕 지수 */}
        <div className='min-w-0 md:col-span-6 lg:col-span-4 col-span-12'>
          <MarketRegimeWidget
            title={t('dashboard.btcDominanceTitle')}
            stateLabel={resolveBtcDominanceStateLabel(t, marketRegime?.btcDominanceClassification)}
            gaugeId='btc-dominance'
            type='btcDominance'
            value={marketRegime?.btcDominance}
            asOf={marketRegime?.asOf}
            isLoading={isPending}
          />
        </div>
        <div className='min-w-0 md:col-span-6 lg:col-span-4 col-span-12'>
          <MarketRegimeWidget
            title={t('dashboard.altcoinIndexTitle')}
            stateLabel={resolveAltcoinSeasonStateLabel(t, marketRegime?.altcoinIndexClassification)}
            gaugeId='altcoin-season-index'
            type='altcoinSeasonIndex'
            value={marketRegime?.altcoinIndex}
            asOf={marketRegime?.asOf}
            isLoading={isPending}
          />
        </div>
        <div className='min-w-0 lg:col-span-4 col-span-12'>
          <FeargreedWidget title={t('feargreed.title')} item={feargreed} asOf={feargreed?.date} isLoading={isPending} />
        </div>
      </div>
    </>
  );
};

export default Page;
