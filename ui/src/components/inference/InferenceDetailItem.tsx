'use client';

import Image from 'next/image';
import React from 'react';

import { Icon } from '@iconify/react';
import { Badge, Tooltip } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Inference } from '@/interfaces/inference.interface';
import { formatDate } from '@/utils/date';

import { DECISION_STYLES } from './style';
import UserImg from '/public/images/profile/user-ai.png';

interface InferenceDetailProps extends Inference {
  isFocus?: boolean;
}

const CopyLinkButton: React.FC<{ inferenceId: string }> = ({ inferenceId }) => {
  const t = useTranslations();

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/inferences/${inferenceId}`;

    try {
      await navigator.clipboard.writeText(url);
      alert(t('copy.complete'));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip content={t('copy.link')} className='whitespace-nowrap'>
      <button
        onClick={handleCopyLink}
        className='p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full'
        aria-label={t('copy.link')}
      >
        <Icon icon='material-symbols:content-copy-outline' className='w-3.5 h-3.5' />
      </button>
    </Tooltip>
  );
};

const InferenceHeader: React.FC<{ item: InferenceDetailProps }> = ({ item }) => {
  const t = useTranslations();

  return (
    <div className='flex items-center gap-6'>
      <Badge color='muted' className={DECISION_STYLES[item.decision].badgeStyle}>
        {item.decision}
      </Badge>
      <div className='flex items-center flex-grow gap-6'>
        <h4 className='text-dark dark:text-white'>
          {item.orderRatio * 100}% {t(`decision.${item.decision}`)}
        </h4>
        <div className='flex items-center justify-between flex-grow'>
          <p>
            {t('inference.bound', {
              lower: item.weightLowerBound * 100,
              upper: item.weightUpperBound * 100,
            })}
          </p>
          <CopyLinkButton inferenceId={item.id} />
        </div>
      </div>
    </div>
  );
};

export const InferenceDetailItem: React.FC<InferenceDetailProps> = ({ isFocus = false, ...item }) => {
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
        <div className='mt-6'>
          <InferenceHeader item={item} />
        </div>
        <div className='flex flex-col mt-3 gap-y-3'>
          <h4 className='text-dark dark:text-white'>{t('inference.reason')}</h4>
          <div className='whitespace-pre-wrap'>{item.reason}</div>
        </div>
        <div className='flex mt-4'>
          <div className='flex gap-1 items-center ms-auto'>
            <Icon icon='mdi:circle-small' className='text-darklink' width={20} height={20} />
            <time className='text-sm text-darklink'>{formatDate(new Date(item.createdAt))}</time>
          </div>
        </div>
      </div>
    </div>
  );
};

export const InferenceDetailSkeleton: React.FC = () => {
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
