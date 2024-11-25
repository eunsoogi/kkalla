'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';

import { Decision } from '@/interfaces/decision.interface';

import { DecisionDetailItem, DecisionDetailSkeleton } from './DecisionDetailItem';
import { getDecisionAction } from './action';

const DecisionDetailContent: React.FC<{ id: string }> = ({ id }) => {
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
    <div className='flex flex-col gap-x-4 gap-y-30 lg:gap-30 mt-30'>
      <DecisionDetailItem {...data} isFocus={true} />
    </div>
  );
};

export const DecisionDetail: React.FC<{ id: string }> = ({ id }) => {
  return (
    <Suspense fallback={<DecisionDetailSkeleton />}>
      <DecisionDetailContent id={id} />
    </Suspense>
  );
};
