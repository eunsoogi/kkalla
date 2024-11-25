'use client';

import React from 'react';

import { Icon } from '@iconify/react';
import { Tooltip } from 'flowbite-react';
import { useTranslations } from 'next-intl';

interface CopyLinkButtonProps {
  path: string;
}

export const CopyLinkButton: React.FC<CopyLinkButtonProps> = ({ path }) => {
  const t = useTranslations();

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      alert(t('copy.complete'));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip content={t('copy.link')} className='whitespace-nowrap'>
      <button
        onClick={handleCopyLink}
        className='p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full'
        aria-label={t('copy.link')}
      >
        <Icon icon='material-symbols:content-copy-outline' className='w-3.5 h-3.5' />
      </button>
    </Tooltip>
  );
};
