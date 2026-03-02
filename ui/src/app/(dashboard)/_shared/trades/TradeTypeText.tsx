'use client';
import React from 'react';

import { TradeTypes } from '@/enums/trade.enum';

import type { TradeTypeTextProps } from './trade-type-text.types';

const TRADE_TYPE_TEXT_CLASS: Record<TradeTypes, string> = {
  [TradeTypes.BUY]: 'text-red-500 dark:text-red-400',
  [TradeTypes.SELL]: 'text-blue-500 dark:text-blue-400',
};

const TRADE_TYPE_ICON: Record<TradeTypes, string> = {
  [TradeTypes.BUY]: '▲',
  [TradeTypes.SELL]: '▼',
};

/**
 * Renders trade type text with icon and color.
 * @param params - Trade type text props.
 * @returns Rendered React element.
 */
export const TradeTypeText: React.FC<TradeTypeTextProps> = ({ type, label, className = '' }) => {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${TRADE_TYPE_TEXT_CLASS[type]} ${className}`}>
      <span aria-hidden='true'>{TRADE_TYPE_ICON[type]}</span>
      <span>{label}</span>
    </span>
  );
};
