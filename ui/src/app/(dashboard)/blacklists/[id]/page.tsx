import React from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { BlacklistForm } from '@/components/blacklist/BlacklistForm';
import { ForbiddenError } from '@/components/error/403';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={[Permission.MANAGE_BLACKLISTS]} fallback={<ForbiddenError />}>
      <BlacklistForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
