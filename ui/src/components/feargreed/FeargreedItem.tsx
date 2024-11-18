'use client';

import React from 'react';

import { useTranslations } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';

export const FeargreedItem: React.FC<Feargreed | null> = (item) => {
  const score = item?.today.score ?? 0;
  const stage = item?.today.stage ?? '';

  return (
    <div className='flex flex-col items-center'>
      <div className='relative w-64 h-64'>
        <svg viewBox='0 0 100 100' className='absolute top-0 left-0 w-full h-full'>
          <circle cx={50} cy={50} r={45} strokeWidth={10} stroke='lightgray' fill='none' />
          <circle
            cx={50}
            cy={50}
            r={45}
            strokeWidth={10}
            stroke='green'
            fill='none'
            strokeDasharray={`${score * 2.83} ${282.6}`}
            strokeDashoffset={score > 0 ? 0 : 282.6}
            transform='rotate(90 50 50)'
          />
        </svg>
        <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold'>
          {score.toLocaleString()}
        </div>
      </div>
      <div className='mt-4 text-center'>
        <p>{stage}</p>
      </div>
    </div>
  );
};

export const FeargreedSkeleton: React.FC = () => {
  const t = useTranslations();

  return <div>{t('loading')}</div>;
};
