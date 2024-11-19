'use client';

import Image from 'next/image';
import React from 'react';

import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { TbPoint } from 'react-icons/tb';

import { Inference } from '@/interfaces/inference.interface';
import { formatDate } from '@/utils/date';

import { DECISION_STYLES } from './style';
import UserImg from '/public/images/profile/user-ai.png';

export const InferenceDetailItem: React.FC<Inference & { isFocus: boolean }> = ({ isFocus = false, ...item }) => {
  const t = useTranslations();

  return (
    <div
      className={`${isFocus && 'border-2 border-primary'} rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark relative w-full break-words`}
    >
      <div className='relative'>
        <Image
          src={UserImg}
          className='h-10 w-10 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
          alt='user'
        />
      </div>
      <div className='p-6'>
        <div className='flex gap-6 mt-6'>
          <Badge color='muted' className={DECISION_STYLES[item.decision].badgeStyle}>
            {item.decision}
          </Badge>
          <div className='flex flex-col lg:flex-row lg:gap-6'>
            <h4 className='text-dark dark:text-white'>
              {item.orderRatio * 100}% {t(`decision.${item.decision}`)}
            </h4>
            <p>
              {t('inference.bound', {
                lower: item.weightLowerBound * 100,
                upper: item.weightUpperBound * 100,
              })}
            </p>
          </div>
        </div>
        <div className='flex flex-col mt-3 gap-x-4 gap-y-3 lg:gap-x-30'>
          <h4 className='text-dark dark:text-white'>{t('inference.reason')}</h4>
          <div>{item.reason}</div>
        </div>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <TbPoint size={15} className='text-darklink' />
            <span className='text-sm text-darklink'>{formatDate(new Date(item.createdAt))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const InferenceDetailSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark relative w-full break-words'>
      <div className='p-6'>
        <div className='flex flex-col mt-3 gap-x-4 gap-y-3 lg:gap-x-30'>
          <h4 className='text-dark dark:text-white'>{t('inference.reason')}</h4>
          <div>{t('nothing')}</div>
        </div>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <TbPoint size={15} className='text-dark' />
            <span className='text-sm text-darklink'>{formatDate(new Date())}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
