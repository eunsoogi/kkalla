'use client';
import React from 'react';

import { useTranslations } from 'next-intl';

/**
 * Renders the Forbidden Error UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const ForbiddenError = () => {
  const t = useTranslations();

  return (
    <div className='flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]'>
      <div className='text-9xl font-bold text-gray-300 dark:text-gray-700'>403</div>
      <h1 className='mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl'>
        {t('error.forbidden.title')}
      </h1>
      <p className='mt-6 text-base leading-7 text-gray-600 dark:text-gray-400'>{t('error.forbidden.description')}</p>
    </div>
  );
};
