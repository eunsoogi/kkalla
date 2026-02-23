'use client';
import React, { useState } from 'react';

import { Datepicker, Label, Select, TextInput } from 'flowbite-react';
import { useLocale, useTranslations } from 'next-intl';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { InferenceDetail } from '@/app/(dashboard)/_shared/inference/_components/InferenceDetail';
import { Category } from '@/enums/category.enum';
import { SortDirection } from '@/enums/sort.enum';
import { Permission } from '@/shared/types/permission.types';

/**
 * Renders the Page UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const Page: React.FC = () => {
  const t = useTranslations();
  const locale = useLocale();
  const [symbol, setSymbol] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.DESC);
  const [category, setCategory] = useState<Category>(Category.COIN_MAJOR);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  return (
    <>
      <div className='grid grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-4 mb-4'>
        <div className='col-span-2 flex flex-col gap-2'>
          <Label htmlFor='symbol'>{t('symbol')}</Label>
          <TextInput
            id='symbol'
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={t('symbolPlaceholder')}
          />
        </div>

        <div className='col-span-2 flex flex-col gap-2'>
          <Label htmlFor='category'>{t('category.label')}</Label>
          <Select id='category' value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            <PermissionGuard permissions={[Permission.VIEW_INFERENCE_COIN_MAJOR]}>
              <option value={Category.COIN_MAJOR}>{t('category.coin.major')}</option>
            </PermissionGuard>
            <PermissionGuard permissions={[Permission.VIEW_INFERENCE_COIN_MINOR]}>
              <option value={Category.COIN_MINOR}>{t('category.coin.minor')}</option>
            </PermissionGuard>
            <PermissionGuard permissions={[Permission.VIEW_INFERENCE_NASDAQ]}>
              <option value={Category.NASDAQ}>{t('category.nasdaq')}</option>
            </PermissionGuard>
          </Select>
        </div>

        <div className='col-span-2 flex flex-col gap-2'>
          <Label htmlFor='sortDirection'>{t('sort.label')}</Label>
          <Select
            id='sortDirection'
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as SortDirection)}
          >
            <option value={SortDirection.DESC}>{t('sort.desc')}</option>
            <option value={SortDirection.ASC}>{t('sort.asc')}</option>
          </Select>
        </div>

        <div className='col-span-1 lg:col-span-3 xl:col-span-2 flex flex-col gap-2'>
          <Label htmlFor='startDate'>{t('date.start')}</Label>
          <Datepicker
            id='startDate'
            value={startDate}
            onChange={(date: Date | null) => date && setStartDate(date)}
            language={locale}
            labelTodayButton={t('date.today')}
            labelClearButton={t('date.clear')}
            className='h-10'
          />
        </div>

        <div className='col-span-1 lg:col-span-3 xl:col-span-2 flex flex-col gap-2'>
          <Label htmlFor='endDate'>{t('date.end')}</Label>
          <Datepicker
            id='endDate'
            value={endDate}
            onChange={(date: Date | null) => date && setEndDate(date)}
            language={locale}
            labelTodayButton={t('date.today')}
            labelClearButton={t('date.clear')}
            className='h-10'
            theme={{
              popup: {
                root: {
                  base: 'absolute z-50 rounded-lg bg-white shadow-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 right-0 lg:left-0',
                  width: 'w-auto',
                } as any,
              },
            }}
          />
        </div>
      </div>
      <InferenceDetail
        type='allocation'
        symbol={symbol}
        category={category}
        sortDirection={sortDirection}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
};

export default Page;
