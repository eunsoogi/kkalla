import React from 'react';

import TradeList from '@/components/trade/trade-list';

import InferenceList from '@/components/inference/inference-list';

const Page = () => {
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
