import React from 'react';

import { useTranslations } from 'next-intl';

import { FeargreedGauge } from '@/components/feargreed/FeargreedGauge';
import { FeargreedTable } from '@/components/feargreed/FeargreedTable';
import { TradeList } from '@/components/trade/TradeList';

const Page: React.FC = () => {
  const t = useTranslations();

  return (
    <>
      <div className='grid grid-cols-12 gap-4 lg:gap-30'>
        <div className='lg:col-span-8 col-span-12'>
          <TradeList />
        </div>
        <h1 className='col-span-12 text-xl text-black dark:text-white'>{t('title.coin')}</h1>
        <div className='lg:col-span-4 col-span-12'>
          <FeargreedGauge />
        </div>
        <div className='lg:col-span-8 col-span-12'>
          <FeargreedTable />
        </div>
      </div>
    </>
  );
};

export default Page;
