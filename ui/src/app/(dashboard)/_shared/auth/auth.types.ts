import type { ReactNode } from 'react';

export interface PermissionGuardProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}
