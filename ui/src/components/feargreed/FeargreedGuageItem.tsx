'use client';

import React from 'react';

import { useTranslations } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';

const getColor = (score: number) => {
  if (score <= 20) return 'var(--color-feargreed-extreme-fear)';
  if (score <= 40) return 'var(--color-feargreed-fear)';
  if (score <= 60) return 'var(--color-feargreed-neutral)';
  if (score <= 80) return 'var(--color-feargreed-greed)';
  return 'var(--color-feargreed-extreme-greed)';
};

const getDiffColor = (diff: number) => {
  return diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-500' : 'text-gray-500';
};

const getDiffPrefix = (diff: number) => {
  return diff > 0 ? '+' : '';
};

export const FeargreedGuageItem: React.FC<Feargreed | null> = (item) => {
  const score = item?.today.score ?? 0;
  const diff = item?.today.diff ?? 0;
  const stage = item?.today.stage ?? '';
  const comment = item?.today.comment ?? '';

  return (
    <div className='flex flex-col items-center'>
      <div className='relative w-64 h-64'>
        <svg viewBox='0 0 100 100' className='absolute top-0 left-0 w-full h-full'>
          <defs>
            <linearGradient id='gaugeGradient' gradientTransform='rotate(90)'>
              <stop offset='0%' stopColor='var(--color-feargreed-extreme-fear)' />
              <stop offset='25%' stopColor='var(--color-feargreed-fear)' />
              <stop offset='50%' stopColor='var(--color-feargreed-neutral)' />
              <stop offset='75%' stopColor='var(--color-feargreed-greed)' />
              <stop offset='100%' stopColor='var(--color-feargreed-extreme-greed)' />
            </linearGradient>
          </defs>
          <circle
            cx={50}
            cy={50}
            r={45}
            strokeWidth={10}
            stroke='url(#gaugeGradient)'
            fill='none'
            opacity={0.3}
            strokeDasharray='180 360'
            transform='rotate(155 50 50)'
          />
          <circle
            cx={50}
            cy={50}
            r={45}
            strokeWidth={10}
            stroke={getColor(score)}
            fill='none'
            strokeDasharray={`${(score * 180) / 100} 360`}
            transform='rotate(155 50 50)'
          />
        </svg>
        <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center'>
          <div className='text-3xl font-bold'>{score.toLocaleString()}</div>
          <div className={`text-lg ${getDiffColor(diff)}`}>
            {getDiffPrefix(diff)}
            {diff.toLocaleString()}
          </div>
          <div className='text-sm mt-1'>{stage}</div>
        </div>
      </div>
      <div className='text-sm text-center max-w-xs -mt-8'>{comment}</div>
    </div>
  );
};

export const FeargreedGuageSkeleton: React.FC = () => {
  const t = useTranslations();

  return <div>{t('loading')}</div>;
};