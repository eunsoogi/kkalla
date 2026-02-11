'use client';

import React from 'react';

import { useQuery } from '@tanstack/react-query';

import { Feargreed } from '@/interfaces/feargreed.interface';

import { FeargreedGuageItem, FeargreedGuageSkeleton } from './FeargreedGuageItem';
import { getFeargreedAction } from './action';

export const FeargreedGauge = () => {
  const { data, isPending } = useQuery<Feargreed | null>({
    queryKey: ['feargreeds'],
    queryFn: () => getFeargreedAction(),
    refetchOnMount: 'always',
  });

  if (isPending) {
    return <FeargreedGuageSkeleton />;
  }

  if (!data) {
    return null;
  }

  return <FeargreedGuageItem {...data} />;
};
