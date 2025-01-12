'use client';

import React, { Suspense } from 'react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { BlacklistForm } from '@/components/blacklist/BlacklistForm';
import { ForbiddenError } from '@/components/error/403';
import { Permission } from '@/interfaces/permission.interface';

const BlacklistFormSkeleton = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      <div className='space-y-6 animate-pulse'>
        <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
        <div className='space-y-4'>
          <div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 mb-2'></div>
            <div className='h-10 bg-gray-200 dark:bg-gray-700 rounded'></div>
          </div>
          <div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 mb-2'></div>
            <div className='h-10 bg-gray-200 dark:bg-gray-700 rounded'></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={[Permission.MANAGE_BLACKLISTS]} fallback={<ForbiddenError />}>
      <Suspense fallback={<BlacklistFormSkeleton />}>
        <BlacklistForm />
      </Suspense>
    </PermissionGuard>
  );
};

export default Page;
