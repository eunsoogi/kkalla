import React from 'react';

import { DecisionTimeline } from '@/components/decision/DecisionTimeline';
import { FeargreedGauge } from '@/components/feargreed/FeargreedGauge';
import { FeargreedTable } from '@/components/feargreed/FeargreedTable';
import { Firechart } from '@/components/firechart/Firechart';
import { TradeList } from '@/components/trade/TradeList';

const Page: React.FC = () => {
  return (
    <>
      <div className='grid grid-cols-12 gap-4 lg:gap-30'>
        <div className='lg:col-span-8 col-span-12'>
          <TradeList />
        </div>
        <div className='lg:col-span-4 col-span-12'>
          <DecisionTimeline />
        </div>
        <div className='lg:col-span-4 col-span-12'>
          <FeargreedGauge />
        </div>
        <div className='lg:col-span-8 col-span-12'>
          <FeargreedTable />
        </div>
        <div className='col-span-12'>
          <Firechart />
        </div>
      </div>
    </>
  );
};

export default Page;
