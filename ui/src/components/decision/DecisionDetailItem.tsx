'use client';

import Image from 'next/image';
import React from 'react';

import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { Decision } from '@/interfaces/decision.interface';
import { formatDate } from '@/utils/date';

import { DecisionItem } from './DecisionItem';
import UserImg from '/public/images/profile/user-ai.png';

interface DecisionDetailProps extends Decision {
  isFocus?: boolean;
}

export const DecisionDetailItem: React.FC<DecisionDetailProps> = ({ isFocus = false, ...item }) => {
  const t = useTranslations();

  return (
    <div
      className={`
        rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark
        relative w-full break-words
        ${isFocus ? 'border-2 border-primary' : ''}
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
        <h4 className='text-dark dark:text-white mt-3'>{item.symbol}</h4>
        <div className='mt-3'>
          <DecisionItem item={item} />
        </div>
        <div className='flex mt-3'>
          <div className='flex gap-1 items-center ms-auto'>
            <Icon icon='mdi:circle-small' className='text-darklink' width={20} height={20} />
            <time className='text-sm text-darklink'>{item.createdAt && formatDate(new Date(item.createdAt))}</time>
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
