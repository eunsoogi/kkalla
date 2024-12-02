import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { UserForm } from '@/components/user/UserForm';

const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={['manage:users']} fallback={<ForbiddenError />}>
      <UserForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
