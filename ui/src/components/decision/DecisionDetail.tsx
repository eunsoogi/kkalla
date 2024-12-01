'use client';

import Image from 'next/image';
import React, { Suspense } from 'react';

import { Icon } from '@iconify/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Decision } from '@/interfaces/decision.interface';
import { formatDate } from '@/utils/date';

import { CopyLinkButton } from '../common/CopyLinkButton';
import { DecisionHorizontalProgressBar } from './DecisionHorizontalProgressBar';
import { DecisionVerticalProgressBar } from './DecisionVerticalProgressBar';
import { getDecisionAction } from './action';
import UserImg from '/public/images/profile/user-ai.png';

const DecisionDetailItem: React.FC<{ id: string }> = ({ id }) => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<Decision | null>({
    queryKey: ['decisions', id],
    queryFn: () => getDecisionAction(id),
    initialData: null,
    staleTime: 0,
  });

  if (!data) {
    return null;
  }

  return (
    <div
      className={`
        flex flex-col gap-x-4 gap-y-30 lg:gap-30 mt-30
        rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark
        relative w-full break-words
        border-2 border-primary
      `}
    >
      <div className='relative'>
        <Image
          src={UserImg}
          className='h-10 w-10 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
          alt={t('profile')}
          priority
        />
      </div>
      <div className='p-6'>
        <div className='flex flex-row gap-6'>
          <h4 className='text-dark dark:text-white'>{data.ticker}</h4>
          <div className='ml-auto'>
            <CopyLinkButton path={`/decisions/${data.id}`} />
          </div>
        </div>
        <div className='lg:hidden mt-3'>
          <DecisionVerticalProgressBar decisions={[data]} />
        </div>
        <div className='hidden lg:block mt-3'>
          <DecisionHorizontalProgressBar decisions={[data]} />
        </div>
        <div className='flex flex-col mt-3'>
          <h4 className='text-dark dark:text-white'>{t('inference.reason')}</h4>
          <div className='whitespace-pre-wrap'>{data.reason}</div>
        </div>
        <div className='flex mt-3'>
          <div className='flex gap-1 items-center ms-auto'>
            <Icon icon='mdi:circle-small' className='text-darklink' width={20} height={20} />
            <time className='text-sm text-darklink'>{data.createdAt && formatDate(new Date(data.createdAt))}</time>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DecisionDetailSkeleton: React.FC = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark relative w-full break-words animate-pulse'>
      <div className='p-6'>
        <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4'></div>
        <div className='h-20 bg-gray-200 dark:bg-gray-700 rounded'></div>
        <div className='flex justify-end mt-4'>
          <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-24'></div>
        </div>
      </div>
    </div>
  );
};

export const DecisionDetail: React.FC<{ id: string }> = ({ id }) => {
  return (
    <Suspense fallback={<DecisionDetailSkeleton />}>
      <DecisionDetailItem id={id} />
    </Suspense>
  );
};
