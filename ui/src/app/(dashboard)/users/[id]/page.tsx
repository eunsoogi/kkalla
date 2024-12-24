import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { UserForm } from '@/components/user/UserForm';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={[Permission.MANAGE_USERS]} fallback={<ForbiddenError />}>
      <UserForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
