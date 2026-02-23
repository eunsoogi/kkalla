'use client';

import React from 'react';

import { Icon } from '@iconify/react';
import { Button } from 'flowbite-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

interface CopyTokenButtonProps {
  className?: string;
}

const CopyTokenButton: React.FC<CopyTokenButtonProps> = ({ className }) => {
  const { data: session } = useSession();
  const t = useTranslations();

  const handleCopyToken = async () => {
    const accessToken = session?.accessToken;
    if (accessToken) {
      try {
        await navigator.clipboard.writeText(accessToken);
        alert(t('copy.complete'));
      } catch (err) {
        console.error('Failed to copy token:', err);
        alert(t('copy.error'));
      }
    } else {
      alert(t('copy.notFound'));
    }
  };

  return (
    <Button onClick={handleCopyToken} className={`flex items-center gap-2 ${className}`} color='gray' size='sm'>
      <Icon icon='material-symbols:content-copy-outline' className='w-3.5 h-3.5' />
      <span>{t('copy.token')}</span>
    </Button>
  );
};

export default CopyTokenButton;
