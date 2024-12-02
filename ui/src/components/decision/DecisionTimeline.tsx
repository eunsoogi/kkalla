'use client';

import Link from 'next/link';
import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { DecisionTypes } from '@/enums/decision.enum';
import { Decision, initialPaginatedState } from '@/interfaces/decision.interface';
import { PaginatedItem } from '@/interfaces/item.interface';
import { formatDate } from '@/utils/date';

import { getDecisionsAction } from './action';
import { getDecisionBadgeStyle, getDecisionDotStyle } from './style';

const DecisionTimelineItem: React.FC = () => {
  const { data } = useSuspenseQuery<PaginatedItem<Decision>>({
    queryKey: ['decisions'],
    queryFn: () => getDecisionsAction({ mine: true }),
    initialData: initialPaginatedState,
    staleTime: 0,
  });

  return (
    <ul>
      {data.items?.map((item: Decision) => (
        <Link key={item.id} href={`/decisions/${item.id}`}>
          <li className='rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800'>
            <div className='flex gap-4 min-h-16'>
              <div className='min-w-20 text-right'>
                <p>{formatDate(new Date(item.createdAt || ''))}</p>
              </div>
              <div className='flex flex-col items-center'>
                <div className={`rounded-full ${getDecisionDotStyle(item.decision)} p-1.5 mt-1.5 w-fit`}></div>
                <div className='h-full w-px bg-border dark:bg-gray-800'></div>
              </div>
              <div className='flex gap-4'>
                <p className='text-dark text-start'>
                  <Badge className={getDecisionBadgeStyle(item.decision)}>{item.decision}</Badge>
                </p>
                <p>{item.ticker}</p>
                {(item.decision === DecisionTypes.BUY || item.decision === DecisionTypes.SELL) && (
                  <p>{Math.floor(item.orderRatio * 100)}%</p>
                )}
              </div>
            </div>
          </li>
        </Link>
      ))}
    </ul>
  );
};

export const DecisionTimelineSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <ul>
      <li>{t('loading')}</li>
    </ul>
  );
};

export const DecisionTimeline: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      <h5 className='card-title text-dark dark:text-white mb-6'>
        <Link href='/inferences'>{t('inference.list')}</Link>
      </h5>
      <div className='flex flex-col mt-2'>
        <Suspense fallback={<DecisionTimelineSkeleton />}>
          <DecisionTimelineItem />
        </Suspense>
      </div>
    </div>
  );
};
