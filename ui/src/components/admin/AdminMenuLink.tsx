'use client';

import Link from 'next/link';
import React from 'react';

import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface AdminMenuLinkProps {
  href: string;
  permissionKey: string;
  translationKey: string;
  icon: string;
}

export const AdminMenuLink: React.FC<AdminMenuLinkProps> = ({ href, permissionKey, translationKey, icon }) => {
  const t = useTranslations();

  return (
    <PermissionGuard permissions={[permissionKey]}>
      <Link
        href={href}
        className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark hover:bg-gray-50 dark:hover:bg-gray-700 p-6 relative break-words transition-colors'
      >
        <div className='flex items-center space-x-4'>
          <Icon icon={icon} className='text-primary w-8 h-8' />
          <h2 className='font-semibold text-black dark:text-white'>{t(translationKey)}</h2>
        </div>
      </Link>
    </PermissionGuard>
  );
};
