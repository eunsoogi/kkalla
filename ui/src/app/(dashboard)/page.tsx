import React from 'react';

import InferenceList from '../../components/inference/inference-list';

const Page = () => {
  return (
    <>
      <div className='grid grid-cols-12 gap-30'>
        <div className='lg:col-span-8 col-span-12'>
          <InferenceList />
        </div>
      </div>
    </>
  );
};

export default Page;
