'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import { Icon } from '@iconify/react';
import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { FeargreedGauge } from '@/components/feargreed/FeargreedGauge';
import { FeargreedTable } from '@/components/feargreed/FeargreedTable';
import { ProfitDashboard } from '@/components/profit/ProfitDashboard';
import { TradeList } from '@/components/trade/TradeList';

const Page: React.FC = () => {
  const t = useTranslations();
  const router = useRouter();

  return (
    <>
      <div className='grid grid-cols-12 gap-4 lg:gap-30'>
        <div className='lg:col-span-4 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full break-words'>
            <h5 className='card-title text-dark dark:text-white'>{t('trade.profit')}</h5>
            <ProfitDashboard />
          </div>
        </div>
        <div className='lg:col-span-8 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
            <div className='px-6'>
              <div className='flex items-center justify-between mb-6'>
                <h5 className='card-title text-dark dark:text-white'>{t('trade.list')}</h5>
                <Button color='gray' size='xs' pill onClick={() => router.push('/trades')}>
                  <Icon icon='uil:arrow-right' className='h-3 w-3' />
                </Button>
              </div>
            </div>
            <TradeList />
          </div>
        </div>
        <h1 className='col-span-12 text-xl text-black dark:text-white'>{t('title.coin')}</h1>
        <div className='lg:col-span-4 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
            <h5 className='card-title text-dark dark:text-white mb-6'>{t('feargreed.title')}</h5>
            <div className='flex flex-col mt-2'>
              <FeargreedGauge />
            </div>
          </div>
        </div>
        <div className='lg:col-span-8 col-span-12'>
          <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
            <div className='px-6'>
              <h5 className='card-title text-dark dark:text-white mb-6'>{t('feargreed.history')}</h5>
            </div>
            <FeargreedTable />
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
