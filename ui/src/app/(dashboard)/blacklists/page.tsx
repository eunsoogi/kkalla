'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { BlacklistTable } from '@/components/blacklist/BlacklistTable';
import { ForbiddenError } from '@/components/error/403';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC = () => {
  const t = useTranslations();

  return (
    <PermissionGuard permissions={[Permission.VIEW_BLACKLISTS]} fallback={<ForbiddenError />}>
      <div className='space-y-6'>
        <BlacklistTable />
        <PermissionGuard permissions={[Permission.MANAGE_BLACKLISTS]} fallback={<ForbiddenError />}>
          <div className='flex justify-end'>
            <Link href='./blacklists/create'>
              <Button color='primary'>{t('blacklist.create')}</Button>
            </Link>
          </div>
        </PermissionGuard>
      </div>
    </PermissionGuard>
  );
};

export default Page;
