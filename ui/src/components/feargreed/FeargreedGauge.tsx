'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';

import { Feargreed } from '@/interfaces/feargreed.interface';

import { FeargreedGuageItem, FeargreedGuageSkeleton } from './FeargreedGuageItem';
import { getFeargreedAction } from './action';

const FeargreedGaugeContent: React.FC = () => {
  const { data } = useSuspenseQuery<Feargreed | null>({
    queryKey: ['feargreeds'],
    queryFn: () => getFeargreedAction(),
    initialData: null,
    refetchOnMount: 'always',
  });

  if (!data) {
    return null;
  }

  return <FeargreedGuageItem {...data} />;
};

export const FeargreedGauge = () => {
  return (
    <Suspense fallback={<FeargreedGuageSkeleton />}>
      <FeargreedGaugeContent />
    </Suspense>
  );
};
