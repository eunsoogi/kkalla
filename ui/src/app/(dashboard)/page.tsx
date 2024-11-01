import React from 'react';

import InferenceList from '@/components/inference/InferenceList';
import TradeList from '@/components/trade/TradeList';

const Page: React.FC = () => {
  return (
    <>
      <div className='grid grid-cols-12 gap-30'>
        <div className='lg:col-span-8 col-span-12'>
          <TradeList />
        </div>
        <div className='lg:col-span-4 col-span-12'>
          <InferenceList />
        </div>
      </div>
    </>
  );
};

export default Page;
