'use client';

import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Permission } from '@/interfaces/permission.interface';

interface ScheduleExecuteButtonProps {
  type: 'existItems' | 'newItems';
  isPending: boolean;
  onExecute: () => void;
}

const ScheduleExecuteButton: React.FC<ScheduleExecuteButtonProps> = ({
  type,
  isPending,
  onExecute,
}) => {
  const t = useTranslations();

  const config = {
    existItems: {
      permission: Permission.EXEC_SCHEDULE_WITH_EXIST_ITEMS,
      color: 'blue' as const,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      titleColor: 'text-blue-900 dark:text-blue-200',
      descColor: 'text-blue-700 dark:text-blue-300',
      title: t('schedule.execute.existItems.title'),
      description: t('schedule.execute.existItems.description'),
      button: t('schedule.execute.existItems.button'),
    },
    newItems: {
      permission: Permission.EXEC_SCHEDULE_WITH_NEW_ITEMS,
      color: 'green' as const,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      titleColor: 'text-green-900 dark:text-green-200',
      descColor: 'text-green-700 dark:text-green-300',
      title: t('schedule.execute.newItems.title'),
      description: t('schedule.execute.newItems.description'),
      button: t('schedule.execute.newItems.button'),
    },
  };

  const currentConfig = config[type];

  return (
    <PermissionGuard permissions={[currentConfig.permission]}>
      <div className={`${currentConfig.bgColor} border ${currentConfig.borderColor} rounded-lg p-4`}>
        <h3 className={`text-lg font-semibold ${currentConfig.titleColor} mb-2`}>
          {currentConfig.title}
        </h3>
        <p className={`${currentConfig.descColor} text-sm mb-4`}>
          {currentConfig.description}
        </p>
        <Button
          color={currentConfig.color}
          onClick={onExecute}
          disabled={isPending}
          className={`w-full ${type === 'newItems' ? 'dark:!bg-green-600 dark:!border-green-600 dark:hover:!bg-green-700' : ''}`}
        >
          {isPending 
            ? t('schedule.execute.executing')
            : currentConfig.button
          }
        </Button>
      </div>
    </PermissionGuard>
  );
};

export default ScheduleExecuteButton;
