'use client';

import React from 'react';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { UserTable } from '@/app/(dashboard)/users/_components/UserTable';
import { Permission } from '@/shared/types/permission.types';

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={[Permission.VIEW_USERS]} fallback={<ForbiddenError />}>
      <UserTable />
    </PermissionGuard>
  );
};

export default Page;
