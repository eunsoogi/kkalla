import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { RoleForm } from '@/components/role/RoleForm';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={[Permission.MANAGE_ROLES]} fallback={<ForbiddenError />}>
      <RoleForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
