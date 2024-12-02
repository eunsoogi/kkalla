'use client';

import React, { Suspense, useActionState } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Label, TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { Role } from '@/interfaces/role.interface';
import { User } from '@/interfaces/user.interface';

import { getRolesAction, getUserAction, updateUserAction } from './action';

interface UserFormProps {
  id: string;
}

const UserFormSkeleton = () => {
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
            <div className='flex gap-2'>
              <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-20'></div>
              <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-20'></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserFormContent: React.FC<UserFormProps> = ({ id }) => {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [formState, formDispatch] = useActionState(updateUserAction, {
    success: false,
    message: '',
  });
  const { pending } = useFormStatus();

  const { data: user } = useSuspenseQuery<User | null>({
    queryKey: ['users', id],
    queryFn: () => getUserAction(id),
    initialData: null,
    staleTime: 0,
  });

  const { data: roles = [] } = useSuspenseQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => getRolesAction(),
    initialData: [],
    staleTime: 0,
  });

  if (!user) {
    return null;
  }

  const userRoleIds = user.roles.map((role) => role.id);

  const handleSubmit = async (payload: FormData) => {
    const selectedRoles = roles.filter((role) => {
      const isChecked = payload.get(`role-${role.id}`) === 'on';
      return isChecked;
    });

    payload.append('roles', JSON.stringify(selectedRoles));

    formDispatch(payload);

    queryClient.invalidateQueries({
      queryKey: ['users', id],
    });
  };

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      {formState.message && (
        <Alert className='mb-6' color={formState.success ? 'success' : 'failure'}>
          {formState.message}
        </Alert>
      )}
      <div className='space-y-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('user.settings')}</h5>
        <form action={handleSubmit} className='space-y-6'>
          <input type='hidden' name='id' value={user.id} />
          <div>
            <Label htmlFor='email' className='flex items-center gap-2 text-base'>
              <Icon icon='mdi:email' className='w-5 h-5' />
              {t('user.email')}
            </Label>
            <TextInput id='email' type='email' value={user.email} className='mt-2' disabled />
          </div>
          <div>
            <Label className='flex items-center gap-2 text-base mb-3'>
              <Icon icon='mdi:key' className='w-5 h-5' />
              {t('user.role')}
            </Label>
            <div className='space-y-3'>
              {roles.map((role) => (
                <div key={role.id} className='flex items-start'>
                  <Checkbox
                    id={`role-${role.id}`}
                    name={`role-${role.id}`}
                    defaultChecked={userRoleIds.includes(role.id)}
                    className='mt-1'
                  />
                  <div className='ml-3'>
                    <Label htmlFor={`role-${role.id}`} className='text-sm font-medium text-gray-900 dark:text-white'>
                      {role.name}
                    </Label>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>{role.permissions.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className='flex justify-end'>
            <Button type='submit' color='primary' disabled={pending}>
              {t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UserForm: React.FC<UserFormProps> = ({ id }) => {
  return (
    <Suspense fallback={<UserFormSkeleton />}>
      <UserFormContent id={id} />
    </Suspense>
  );
};
