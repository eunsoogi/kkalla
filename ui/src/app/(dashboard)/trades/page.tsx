'use client';
import React, { useState } from 'react';

import { Datepicker, Label, Select, TextInput } from 'flowbite-react';
import { useLocale, useTranslations } from 'next-intl';

import { TradeDetail } from '@/app/(dashboard)/trades/_components/TradeDetail';
import { SortDirection } from '@/enums/sort.enum';
import { TradeTypes } from '@/enums/trade.enum';

/**
 * Renders the Page UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const Page: React.FC = () => {
  const t = useTranslations();
  const locale = useLocale();
  const [symbol, setSymbol] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.DESC);
  const [type, setType] = useState<TradeTypes | undefined>(undefined);
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
          <Label htmlFor='type'>{t('trade.type')}</Label>
          <Select id='type' value={type} onChange={(e) => setType(e.target.value as TradeTypes)}>
            <option value=''>{t('all')}</option>
            <option value={TradeTypes.BUY}>{t('trade.types.buy')}</option>
            <option value={TradeTypes.SELL}>{t('trade.types.sell')}</option>
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
      <TradeDetail symbol={symbol} type={type} sortDirection={sortDirection} startDate={startDate} endDate={endDate} />
    </>
  );
};

export default Page;
