'use client';
import React, { ReactNode } from 'react';

import { useSession } from 'next-auth/react';

import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders the Permission Guard UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const PermissionGuard = ({ permissions, children, fallback }: PermissionGuardProps) => {
  const { status } = useSession();
  const { hasPermission } = usePermissions();

  if (status === 'loading') {
    return null;
  }

  if (!hasPermission(permissions)) {
    return fallback || null;
  }

  return <>{children}</>;
};
