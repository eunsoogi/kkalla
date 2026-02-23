import React from 'react';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { BlacklistForm } from '@/app/(dashboard)/blacklists/_components/BlacklistForm';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { Permission } from '@/shared/types/permission.types';

/**
 * Renders the Page UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={[Permission.MANAGE_BLACKLISTS]} fallback={<ForbiddenError />}>
      <BlacklistForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
