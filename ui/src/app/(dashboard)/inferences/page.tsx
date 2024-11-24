'use client';

import React, { useState } from 'react';

import { Datepicker, Label, Select } from 'flowbite-react';
import { useLocale, useTranslations } from 'next-intl';

import { InferenceDetailList } from '@/components/inference/InferenceDetailList';
import { SortDirection } from '@/enums/sort.enum';

const Page: React.FC = () => {
  const t = useTranslations();
  const locale = useLocale();
  const [mine, setMine] = useState(false);
  const [decision, setDecision] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.DESC);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  return (
    <>
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4'>
        <div className='col-span-1 lg:col-span-2 flex flex-col gap-2 justify-end'>
          <label className='flex items-center h-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-3 rounded-lg'>
            <input
              type='checkbox'
              id='mineCheckbox'
              checked={mine}
              onChange={() => setMine(!mine)}
              className='form-checkbox h-5 w-5 text-primary border-gray-300 rounded'
            />
            <span className='ml-2 text-sm text-gray-700 dark:text-gray-400 select-none'>{t('inference.mine')}</span>
          </label>
        </div>

        <div className='col-span-1 lg:col-span-2 flex flex-col gap-2'>
          <Label htmlFor='decision' value={t('inference.decision')} />
          <Select id='decision' value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value=''>{t('all')}</option>
            <option value='buy'>{t('decision.buy')}</option>
            <option value='sell'>{t('decision.sell')}</option>
            <option value='hold'>{t('decision.hold')}</option>
          </Select>
        </div>

        <div className='col-span-1 lg:col-span-3 flex flex-col gap-2'>
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

        <div className='col-span-1 lg:col-span-3 flex flex-col gap-2'>
          <Label htmlFor='endDate' value={t('date.end')} />
          <Datepicker
            id='endDate'
            value={endDate}
            onChange={(date: Date | null) => date && setEndDate(date)}
            language={locale}
            labelTodayButton={t('date.today')}
            labelClearButton={t('date.clear')}
            className='h-10'
          />
        </div>

        <div className='col-span-1 lg:col-span-2 flex flex-col gap-2'>
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
      </div>
      <InferenceDetailList
        mine={mine}
        decision={decision}
        sortDirection={sortDirection}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
};

export default Page;
