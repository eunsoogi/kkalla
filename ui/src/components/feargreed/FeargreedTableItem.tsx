'use client';

import React from 'react';

import { Icon } from '@iconify/react';
import { TableBody, TableCell, TableRow } from 'flowbite-react';
import { useFormatter } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';

const MS_1H = 60 * 60 * 1000;

export const FeargreedTableItem: React.FC<Feargreed | null> = (item) => {
  const formatter = useFormatter();
  const [now] = React.useState(() => Date.now());

  if (!item) {
    return null;
  }

  const diff = item.diff ?? 0;
  const itemTime = new Date(item.date).getTime();
  const isNew = now - itemTime <= MS_1H;

  return (
    <TableRow className='border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'>
      <TableCell className='w-0 px-4 py-3 align-top'>
        {isNew && (
          <Icon
            icon='mdi:new-box'
            className='shrink-0 text-red-500 dark:text-red-400'
            height={24}
            width={24}
          />
        )}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>{formatter.relativeTime(new Date(item.date))}</TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>{item.value.toLocaleString()}</TableCell>
      <TableCell className={`px-4 py-3 whitespace-nowrap text-sm ${getDiffColor(diff)}`}>
        {getDiffPrefix(diff)}
        {diff.toLocaleString()}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>{item.classification}</TableCell>
    </TableRow>
  );
};

export const FeargreedTableSkeleton: React.FC = () => (
  <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
    {[1, 2, 3].map((i) => (
      <TableRow key={i}>
        <TableCell className='w-0 px-4 py-3' />
        <TableCell className='px-4 py-3'><div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20' /></TableCell>
        <TableCell className='px-4 py-3'><div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-12' /></TableCell>
        <TableCell className='px-4 py-3'><div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-14' /></TableCell>
        <TableCell className='px-4 py-3'><div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24' /></TableCell>
      </TableRow>
    ))}
  </TableBody>
);
