'use client';

import Link from 'next/link';
import React from 'react';

import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Decision } from '@/interfaces/decision.interface';
import { formatDate } from '@/utils/date';

import { DECISION_STYLES } from './style';

export const DecisionLineItem: React.FC<Decision> = (item: Decision) => {
  return (
    <Link href={`/decisions/${item.id}`}>
      <li className='rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800'>
        <div className='flex gap-4 min-h-16'>
          <div className='min-w-24'>
            <p>{formatDate(new Date(item.createdAt || ''))}</p>
          </div>
          <div className='flex flex-col items-center'>
            <div className={`rounded-full ${DECISION_STYLES[item.decision].dotStyle} p-1.5 w-fit`}></div>
            <div className='h-full w-px bg-border dark:bg-gray-800'></div>
          </div>
          <div className='flex gap-4'>
            <p className='text-dark text-start'>
              <Badge className={DECISION_STYLES[item.decision].badgeStyle}>{item.decision}</Badge>
            </p>
            <p>{item.orderRatio * 100}%</p>
          </div>
        </div>
      </li>
    </Link>
  );
};

export const DecisionLineSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <ul>
      <li>{t('loading')}</li>
    </ul>
  );
};
