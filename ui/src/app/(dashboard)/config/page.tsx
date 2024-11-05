import React from 'react';

import OpenaiForm from '@/components/config/openai-form';
import ScheduleForm from '@/components/config/schedule-form';
import UpbitForm from '@/components/config/upbit-form';

const Page: React.FC = () => {
  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words divide-y divide-gray-100'>
        <div className='py-6'>
          <ScheduleForm />
        </div>
        <div className='py-6'>
          <OpenaiForm />
        </div>
        <div className='py-6'>
          <UpbitForm />
        </div>
      </div>
    </>
  );
};

export default Page;
