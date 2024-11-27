'use client';

import { useSession } from 'next-auth/react';

export const usePermissions = () => {
  const { data: session } = useSession();

  const hasPermission = (permissions: string[]) => {
    return permissions.every((permission) => session?.permissions?.includes(permission));
  };

  return { hasPermission };
};
