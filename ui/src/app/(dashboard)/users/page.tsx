'use client';

import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { UserTable } from '@/components/user/UserTable';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={[Permission.VIEW_USERS]} fallback={<ForbiddenError />}>
      <UserTable />
    </PermissionGuard>
  );
};

export default Page;
