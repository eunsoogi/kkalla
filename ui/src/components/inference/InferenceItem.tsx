'use client';

import Link from 'next/link';
import React from 'react';

import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Inference } from '@/interfaces/inference.interface';
import { formatDate } from '@/utils/date';

import { DECISION_STYLES } from './style';

export const InferenceItem: React.FC<Inference> = (item: Inference) => {
  return (
    <Link href={`/inferences/${item.id}`}>
      <li className='rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800'>
        <div className='flex gap-4 min-h-16'>
          <div className='min-w-24'>
            <p>{formatDate(new Date(item.createdAt))}</p>
          </div>
          <div className='flex flex-col items-center'>
            <div className={`rounded-full ${DECISION_STYLES[item.decision].dotStyle} p-1.5 w-fit`}></div>
            <div className='h-full w-px bg-border dark:bg-gray-800'></div>
          </div>
          <div className='flex gap-4'>
            <p className='text-dark text-start'>
              <Badge className={DECISION_STYLES[item.decision].badgeStyle}>{item.decision}</Badge>
            </p>
            <p>{item.rate * 100}%</p>
          </div>
        </div>
      </li>
    </Link>
  );
};

export const InferenceSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <ul>
      <li>{t('loading')}</li>
    </ul>
  );
};
