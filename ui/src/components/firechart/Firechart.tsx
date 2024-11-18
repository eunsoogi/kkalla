'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { FirechartItem, FirechartSkeleton } from './FirechartItem';
import { getFirechartAction } from './action';

const FirechartContent: React.FC = () => {
  const { data } = useSuspenseQuery<string | null>({
    queryKey: ['firecharts'],
    queryFn: () => getFirechartAction(),
    initialData: null,
    staleTime: 0,
  });

  return <FirechartItem src={data} />;
};

export const Firechart: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      <h5 className='card-title text-dark dark:text-white mb-6'>{t('firechart.title')}</h5>
      <div className='flex flex-col mt-2'>
        <Suspense fallback={<FirechartSkeleton />}>
          <FirechartContent />
        </Suspense>
      </div>
    </div>
  );
};
