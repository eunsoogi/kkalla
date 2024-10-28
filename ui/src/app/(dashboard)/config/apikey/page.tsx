import React from 'react';

import OpenaiForm from '@/components/config/apikey/openai-form';
import UpbitForm from '@/components/config/apikey/upbit-form';

const Page = () => {
  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words'>
        <OpenaiForm />
        <UpbitForm />
      </div>
    </>
  );
};

export default Page;
