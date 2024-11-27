'use client';

import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { UsersTable } from '@/components/users/UsersTable';

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={['view:users']} fallback={<ForbiddenError />}>
      <UsersTable />
    </PermissionGuard>
  );
};

export default Page;
