import React from 'react';

import CategoryForm from '@/components/category/CategoryForm';
import ScheduleForm from '@/components/config/ScheduleForm';
import UpbitForm from '@/components/config/UpbitForm';
import UpbitGuide from '@/components/config/UpbitGuide';

const Page: React.FC = () => {
  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full break-words divide-y divide-gray-100 dark:divide-gray-800'>
        <div className='py-6'>
          <UpbitGuide />
        </div>
        <div className='py-6'>
          <UpbitForm />
        </div>
        <div className='py-6'>
          <ScheduleForm />
        </div>
        <div className='py-6'>
          <CategoryForm />
        </div>
      </div>
    </>
  );
};

export default Page;
