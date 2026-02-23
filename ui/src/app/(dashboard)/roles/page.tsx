'use client';
import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { RoleTable } from '@/app/(dashboard)/roles/_components/RoleTable';
import { Permission } from '@/shared/types/permission.types';

/**
 * Renders the Page UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const Page: React.FC = () => {
  const t = useTranslations();

  return (
    <PermissionGuard permissions={[Permission.VIEW_ROLES]} fallback={<ForbiddenError />}>
      <div className='space-y-6'>
        <RoleTable />
        <PermissionGuard permissions={[Permission.MANAGE_ROLES]} fallback={<ForbiddenError />}>
          <div className='flex justify-end'>
            <Link href='./roles/create'>
              <Button color='primary'>{t('role.create')}</Button>
            </Link>
          </div>
        </PermissionGuard>
      </div>
    </PermissionGuard>
  );
};

export default Page;
