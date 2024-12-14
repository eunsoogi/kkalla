import React from 'react';

import SlackForm from '@/components/config/SlackForm';
import SlackGuide from '@/components/config/SlackGuide';

const Page: React.FC = () => {
  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full break-words divide-y divide-gray-100 dark:divide-gray-800'>
        <div className='py-6'>
          <SlackGuide />
        </div>
        <div className='py-6'>
          <SlackForm />
        </div>
      </div>
    </>
  );
};

export default Page;
