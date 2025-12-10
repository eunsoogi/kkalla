'use client';

import React from 'react';

import { TableBody, TableCell, TableRow } from 'flowbite-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';

export const FeargreedTableItem: React.FC<Feargreed | null> = (item) => {
  const formatter = useFormatter();

  if (!item) {
    return null;
  }

  const diff = item.diff ?? 0; // 이전 값과의 차이

  return (
    <TableRow>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{formatter.relativeTime(new Date(item.date))}</TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{item.value.toLocaleString()}</TableCell>
      <TableCell className={`px-3 py-3 whitespace-nowrap ${getDiffColor(diff)}`}>
        {getDiffPrefix(diff)}
        {diff.toLocaleString()}
      </TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{item.classification}</TableCell>
    </TableRow>
  );
};

export const FeargreedTableSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <TableBody className='divide-y divide-border dark:divide-gray-800'>
      <TableRow>
        <TableCell>{t('loading')}</TableCell>
      </TableRow>
    </TableBody>
  );
};
