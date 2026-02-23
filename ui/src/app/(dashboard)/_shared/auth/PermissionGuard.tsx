'use client';

import React, { ReactNode } from 'react';

import { useSession } from 'next-auth/react';

import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

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
