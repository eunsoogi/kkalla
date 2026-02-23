'use client';
import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { BlacklistTable } from '@/app/(dashboard)/blacklists/_components/BlacklistTable';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { Permission } from '@/shared/types/permission.types';

/**
 * Renders the Page UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
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
