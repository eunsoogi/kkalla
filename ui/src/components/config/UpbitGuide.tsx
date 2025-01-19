'use client';

import Image from 'next/image';
import React, { Suspense, useCallback } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { ColoredBadge } from '@/components/common/ColoredBadge';

import { getIpAction } from './action';
import UpbitGuideImg from '/public/images/register/upbit-guide.png';

const ipQueryKey = ['upbit', 'ip'];

const UpbitIp: React.FC = () => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<string | null>({
    queryKey: ipQueryKey,
    queryFn: getIpAction,
    initialData: t('status.unknown'),
    staleTime: 0,
  });

  return (
    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300'>
      <span className='font-medium'>IP:</span>
      <code className='px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded'>{data}</code>
    </div>
  );
};

const UpbitIpSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300'>
      <span className='font-medium'>IP:</span>
      <code className='px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded'>{t('status.unknown')}</code>
    </div>
  );
};

const UpbitGrants: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300'>
      <span className='font-medium'>{t('upbit.grant')}:</span>
      <div className='flex gap-2'>
        <ColoredBadge text={t('upbit.grants.view_asset')} />
        <ColoredBadge text={t('upbit.grants.order')} />
      </div>
    </div>
  );
};

const UpbitGuide: React.FC = () => {
  const t = useTranslations();

  const handleGuideClick = useCallback(() => {
    window.open(UpbitGuideImg.src, '_blank');
  }, []);

  const handleLinkClick = useCallback(() => {
    window.open('https://upbit.com/mypage/open_api_management', '_blank');
  }, []);

  return (
    <>
      <div className='flex flex-column items-center gap-2'>
        <h5 className='card-title text-dark dark:text-white'>{t('upbit.guide')}</h5>
      </div>
      <div className='mt-6 space-y-4'>
        <div className='text-gray-700 dark:text-gray-300'>{t('upbit.description')}</div>
        <div className='space-y-2'>
          <UpbitGrants />
          <Suspense fallback={<UpbitIpSkeleton />}>
            <UpbitIp />
          </Suspense>
        </div>
      </div>
      <Image
        onClick={handleGuideClick}
        src={UpbitGuideImg.src}
        width={UpbitGuideImg.width}
        height={UpbitGuideImg.height}
        alt={t('upbit.guide')}
        className='rounded-xl w-full mt-6 cursor-pointer'
      />
      <div className='flex justify-center mt-4'>
        <Button onClick={handleLinkClick} color={'primary'}>
          {t('upbit.link')}
        </Button>
      </div>
    </>
  );
};

export default UpbitGuide;
