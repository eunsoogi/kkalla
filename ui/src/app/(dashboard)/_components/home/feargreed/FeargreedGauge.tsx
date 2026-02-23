'use client';
import React from 'react';

import { Feargreed } from '@/app/(dashboard)/_components/home/feargreed/_types/feargreed.types';

import { FeargreedGuageItem, FeargreedGuageSkeleton } from './FeargreedGuageItem';

interface FeargreedGaugeProps {
  item?: Feargreed | null;
  isLoading?: boolean;
}

/**
 * Renders the Feargreed Gauge UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const FeargreedGauge = ({ item = null, isLoading = false }: FeargreedGaugeProps) => {
  if (isLoading) {
    return <FeargreedGuageSkeleton />;
  }

  if (!item) {
    return null;
  }

  return <FeargreedGuageItem {...item} />;
};
