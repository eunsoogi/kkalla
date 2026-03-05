'use client';
import React, { Suspense, useCallback } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { ColoredBadge } from '@/app/(dashboard)/_shared/ui/ColoredBadge';

import { getIpAction } from '@/app/(dashboard)/_shared/settings/_actions/settings.actions';

const ipQueryKey = ['upbit', 'ip'];

/**
 * Renders the Upbit Ip UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const UpbitIp: React.FC = () => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<string | null>({
    queryKey: ipQueryKey,
    queryFn: getIpAction,
    initialData: t('status.unknown'),
    refetchOnMount: 'always',
  });

  const handleCopyIp = useCallback(async () => {
    const ip = typeof data === 'string' ? data.trim() : '';
    if (!ip || ip === t('status.unknown')) {
      alert(t('copy.notFound'));
      return;
    }

    try {
      await navigator.clipboard.writeText(ip);
      alert(t('copy.complete'));
    } catch (error) {
      console.error('Failed to copy ip:', error);
      alert(t('copy.error'));
    }
  }, [data, t]);

  return (
    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300'>
      <span className='font-medium'>{t('upbit.ip_label')}:</span>
      <code className='px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded'>{data}</code>
      <Button type='button' color='gray' size='xs' onClick={handleCopyIp}>
        {t('copy.ip')}
      </Button>
    </div>
  );
};

/**
 * Renders the Upbit Ip Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const UpbitIpSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300'>
      <span className='font-medium'>{t('upbit.ip_label')}:</span>
      <code className='px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded'>{t('status.unknown')}</code>
      <Button type='button' color='gray' size='xs' disabled>
        {t('copy.ip')}
      </Button>
    </div>
  );
};

/**
 * Renders the Upbit Grants UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const UpbitGrants: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300'>
      <span className='font-medium'>{t('upbit.grant')}:</span>
      <div className='flex gap-2'>
        <ColoredBadge text={t('upbit.grants.view_asset')} />
        <ColoredBadge text={t('upbit.grants.view_order')} />
        <ColoredBadge text={t('upbit.grants.order')} />
      </div>
    </div>
  );
};

/**
 * Renders the Upbit Guide UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const UpbitGuide: React.FC = () => {
  const t = useTranslations();

  const handleLinkClick = useCallback(() => {
    window.open('https://upbit.com/mypage/open_api_management', '_blank');
  }, []);

  return (
    <>
      <div className='flex flex-col items-start gap-2 text-left w-full'>
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
      <div className='flex justify-center mt-4'>
        <Button onClick={handleLinkClick} color={'primary'}>
          {t('upbit.link')}
        </Button>
      </div>
    </>
  );
};

export default UpbitGuide;
