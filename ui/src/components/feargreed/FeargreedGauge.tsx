'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';

import { FeargreedItem, FeargreedSkeleton } from './FeargreedItem';
import { getFeargreedAction } from './action';

const FeargreedGaugeContent: React.FC = () => {
  const { data } = useSuspenseQuery<Feargreed | null>({
    queryKey: ['feargreeds'],
    queryFn: () => getFeargreedAction(),
    initialData: null,
    staleTime: 0,
  });

  console.log(data);

  if (!data) {
    return null;
  }

  return <FeargreedItem {...data} />;
};

export const FeargreedGauge = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      <h5 className='card-title text-dark dark:text-white mb-6'>{t('feargreed.title')}</h5>
      <div className='flex flex-col mt-2'>
        <Suspense fallback={<FeargreedSkeleton />}>
          <FeargreedGaugeContent />
        </Suspense>
      </div>
    </div>
  );
};
