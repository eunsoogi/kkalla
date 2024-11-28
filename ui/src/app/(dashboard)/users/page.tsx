'use client';

import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { UserTable } from '@/components/user/UserTable';

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={['view:users']} fallback={<ForbiddenError />}>
      <UserTable />
    </PermissionGuard>
  );
};

export default Page;
