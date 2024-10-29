'use client';

import React, { Suspense } from 'react';

import { Badge } from 'flowbite-react';

import { formatDate } from '@/utils/date';

import { useInferencesSuspenseQuery } from './hook';
import { Inference } from './type';

const DECISION_STYLES = {
  buy: {
    dotStyle: 'bg-success',
    badgeStyle: 'text-success bg-lightsuccess',
  },
  hold: {
    dotStyle: 'bg-warning',
    badgeStyle: 'text-warning bg-lightwarning',
  },
  sell: {
    dotStyle: 'bg-error',
    badgeStyle: 'text-error bg-lighterror',
  },
} as const;

const InferenceContent = () => {
  const { data } = useInferencesSuspenseQuery();

  return (
    <ul>
      {data.items.map((item: Inference) => (
        <li key={item.id}>
          <div className='flex gap-4 min-h-16'>
            <div>
              <p>{formatDate(new Date(item.createdAt))}</p>
            </div>
            <div className='flex flex-col items-center'>
              <div className={`rounded-full ${DECISION_STYLES[item.decision].dotStyle} p-1.5 w-fit`}></div>
              <div className='h-full w-px bg-border'></div>
            </div>
            <div className='flex gap-4'>
              <p className='text-dark text-start'>
                <Badge className={DECISION_STYLES[item.decision].badgeStyle}>{item.decision}</Badge>
              </p>
              <p>{item.rate * 100}%</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

const InferenceSkeleton = () => {
  return (
    <ul>
      <li>로딩 중...</li>
    </ul>
  );
};

const InferenceList = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words'>
      <h5 className='card-title mb-6'>추론 목록</h5>
      <div className='flex flex-col mt-2'>
        <Suspense fallback={<InferenceSkeleton />}>
          <InferenceContent />
        </Suspense>
      </div>
    </div>
  );
};

export default InferenceList;
