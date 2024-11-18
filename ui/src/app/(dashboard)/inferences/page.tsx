'use client';

import React, { useState } from 'react';

import { useTranslations } from 'next-intl';

import { InferenceDetailList } from '@/components/inference/InferenceDetailList';

const Page: React.FC = () => {
  const t = useTranslations();
  const [mine, setMine] = useState(false);

  return (
    <>
      <div className='flex items-center mb-4'>
        <input
          type='checkbox'
          id='mineCheckbox'
          checked={mine}
          onChange={() => setMine(!mine)}
          className='form-checkbox h-5 w-5 text-primary border-gray-300 rounded'
        />
        <label htmlFor='mineCheckbox' className='ml-2 text-sm text-gray-700 dark:text-gray-400'>
          {t('inference.mine')}
        </label>
      </div>
      <InferenceDetailList mine={mine} />
    </>
  );
};

export default Page;
