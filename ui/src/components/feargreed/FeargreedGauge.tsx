'use client';

import React from 'react';

import { Feargreed } from '@/interfaces/feargreed.interface';

import { FeargreedGuageItem, FeargreedGuageSkeleton } from './FeargreedGuageItem';

interface FeargreedGaugeProps {
  item?: Feargreed | null;
  isLoading?: boolean;
}

export const FeargreedGauge = ({ item = null, isLoading = false }: FeargreedGaugeProps) => {
  if (isLoading) {
    return <FeargreedGuageSkeleton />;
  }

  if (!item) {
    return null;
  }

  return <FeargreedGuageItem {...item} />;
};
