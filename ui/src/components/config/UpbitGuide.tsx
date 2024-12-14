'use client';

import Image from 'next/image';
import React, { Suspense, useCallback } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { getIpAction } from './action';
import UpbitGuideImg from '/public/images/register/upbit-guide.png';

const ipQueryKey = ['upbit', 'ip'];

const UpbitDescription: React.FC = () => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<string | null>({
    queryKey: ipQueryKey,
    queryFn: getIpAction,
    initialData: t('status.unknown'),
    staleTime: 0,
  });

  return (
    <div className='mt-6'>
      {t('upbit.description', {
        ip: data,
      })}
    </div>
  );
};

const UpbitDescriptionSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='mt-6'>
      {t('upbit.description', {
        ip: t('status.unknown'),
      })}
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
      <Suspense fallback={<UpbitDescriptionSkeleton />}>
        <UpbitDescription />
      </Suspense>
      <Image
        src={UpbitGuideImg.src}
        width={UpbitGuideImg.width}
        height={UpbitGuideImg.height}
        alt={t('upbit.guide')}
        className='rounded-xl w-full mt-6 cursor-pointer'
        onClick={handleGuideClick}
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
