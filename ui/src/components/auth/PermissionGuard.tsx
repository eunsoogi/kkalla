'use client';

import React, { ReactNode } from 'react';

import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGuard = ({ permissions, children, fallback }: PermissionGuardProps) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permissions)) {
    return fallback || null;
  }

  return <>{children}</>;
};
