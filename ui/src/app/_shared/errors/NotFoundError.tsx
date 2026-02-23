'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

export const NotFoundError = () => {
  const t = useTranslations();

  return (
    <div className='flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]'>
      <div className='text-9xl font-bold text-gray-300 dark:text-gray-700'>404</div>
      <h1 className='mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl'>
        {t('error.notFound.title')}
      </h1>
      <p className='mt-6 text-base leading-7 text-gray-600 dark:text-gray-400'>{t('error.notFound.description')}</p>
      <Button color='primary' as={Link} href='/' className='w-fit mt-6'>
        {t('error.notFound.home')}
      </Button>
    </div>
  );
};
