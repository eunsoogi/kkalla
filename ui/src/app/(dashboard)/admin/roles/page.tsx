'use client';

import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { RoleTable } from '@/components/role/RoleTable';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={[Permission.VIEW_ROLES]} fallback={<ForbiddenError />}>
      <RoleTable />
    </PermissionGuard>
  );
};

export default Page;
