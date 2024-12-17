'use client';

import React, { useState } from 'react';

import { Datepicker, Label, Select, TextInput } from 'flowbite-react';
import { useLocale, useTranslations } from 'next-intl';

import { TradeDetail } from '@/components/trade/TradeDetail';
import { SortDirection } from '@/enums/sort.enum';
import { TradeTypes } from '@/enums/trade.enum';

const Page: React.FC = () => {
  const t = useTranslations();
  const locale = useLocale();
  const [ticker, setTicker] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.DESC);
  const [type, setType] = useState<TradeTypes | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  return (
    <>
      <div className='grid grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-6 mb-4'>
        <div className='col-span-2 flex flex-col gap-2'>
          <Label htmlFor='ticker' value={t('trade.ticker')} />
          <TextInput id='ticker' value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder='BTC/KRW' />
        </div>

        <div className='col-span-2 flex flex-col gap-2'>
          <Label htmlFor='type' value={t('trade.type')} />
          <Select id='type' value={type} onChange={(e) => setType(e.target.value as TradeTypes)}>
            <option value=''>{t('all')}</option>
            <option value={TradeTypes.BUY}>{t('trade.types.buy')}</option>
            <option value={TradeTypes.SELL}>{t('trade.types.sell')}</option>
          </Select>
        </div>

        <div className='col-span-2 flex flex-col gap-2'>
          <Label htmlFor='sortDirection' value={t('sort.label')} />
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
          <Label htmlFor='startDate' value={t('date.start')} />
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
          <Label htmlFor='endDate' value={t('date.end')} />
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
      <TradeDetail ticker={ticker} type={type} sortDirection={sortDirection} startDate={startDate} endDate={endDate} />
    </>
  );
};

export default Page;
