import React from 'react';

import { AdminMenuLink } from '@/components/admin/AdminMenuLink';
import { Permission } from '@/interfaces/permission.interface';

export default function AdminPage() {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
      <AdminMenuLink
        href='./admin/users'
        permissionKey={Permission.VIEW_USERS}
        translationKey='menu.userManagement'
        icon='solar:users-group-rounded-line-duotone'
      />
      <AdminMenuLink
        href='./admin/roles'
        permissionKey={Permission.VIEW_ROLES}
        translationKey='menu.roleManagement'
        icon='solar:shield-user-line-duotone'
      />
    </div>
  );
}
