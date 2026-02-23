import React from 'react';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { UserForm } from '@/app/(dashboard)/users/_components/UserForm';
import { Permission } from '@/shared/types/permission.types';

const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={[Permission.MANAGE_USERS]} fallback={<ForbiddenError />}>
      <UserForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
