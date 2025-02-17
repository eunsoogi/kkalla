'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { RoleTable } from '@/components/role/RoleTable';
import { Permission } from '@/interfaces/permission.interface';

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
