import React from 'react';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { RoleForm } from '@/app/(dashboard)/roles/_components/RoleForm';
import { Permission } from '@/shared/types/permission.types';

/**
 * Renders the Page UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;

  return (
    <PermissionGuard permissions={[Permission.MANAGE_ROLES]} fallback={<ForbiddenError />}>
      <RoleForm id={id} />
    </PermissionGuard>
  );
};

export default Page;
