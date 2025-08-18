'use client';

import React, { useState, useTransition } from 'react';

import { Alert } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { Permission } from '@/interfaces/permission.interface';
import { executeExistItemsAction, executeNewItemsAction } from '@/components/schedule/action';
import ScheduleExecuteButton from '@/components/schedule/ScheduleExecuteButton';
import ScheduleWarning from '@/components/schedule/ScheduleWarning';

const Page: React.FC = () => {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExecuteExistItems = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await executeExistItemsAction();
      
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message || '',
      });
    });
  };

  const handleExecuteNewItems = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await executeNewItemsAction();
      
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message || '',
      });
    });
  };

  return (
    <PermissionGuard 
      permissions={[Permission.EXEC_SCHEDULE_WITH_EXIST_ITEMS, Permission.EXEC_SCHEDULE_WITH_NEW_ITEMS]} 
      fallback={<ForbiddenError />}
    >
      <div className='space-y-6'>
        <div className='bg-white dark:bg-dark rounded-lg shadow-md dark:shadow-dark-md p-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>
            {t('schedule.management.title')}
          </h1>
          <p className='text-gray-600 dark:text-gray-300 mb-6'>
            {t('schedule.management.description')}
          </p>

          {message && (
            <Alert color={message.type === 'success' ? 'success' : 'failure'} className='mb-4'>
              {message.text}
            </Alert>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <ScheduleExecuteButton
              type='existItems'
              isPending={isPending}
              onExecute={handleExecuteExistItems}
            />

            <ScheduleExecuteButton
              type='newItems'
              isPending={isPending}
              onExecute={handleExecuteNewItems}
            />
          </div>

          <ScheduleWarning />
        </div>
      </div>
    </PermissionGuard>
  );
};

export default Page;
