'use client';
import { useRouter } from 'next/navigation';
import React, { Suspense, useActionState } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Label, TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { Permission } from '@/shared/types/permission.types';
import { Role } from '@/shared/types/role.types';

import { createRoleAction, deleteRoleAction, getPermissionsAction, getRoleAction, updateRoleAction } from '../_actions/role.actions';

interface RoleFormProps {
  id?: string;
}

/**
 * Renders the Role Form Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const RoleFormSkeleton = () => {
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
          <div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 mb-2'></div>
            <div className='flex flex-wrap gap-2'>
              {[1, 2, 3, 4, 5].map((_, index) => (
                <div key={index} className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-20'></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders the Role Form Content UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const RoleFormContent: React.FC<RoleFormProps> = ({ id }) => {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const router = useRouter();

  const action = id ? updateRoleAction : createRoleAction;
  const [state, formDispatch] = useActionState(action, {
    success: false,
    message: '',
  });
  const { pending } = useFormStatus();

  const { data: role } = useSuspenseQuery<Role | null>({
    queryKey: ['role', id],
    queryFn: () => (id ? getRoleAction(id) : null),
    initialData: null,
    refetchOnMount: 'always',
  });

  const { data: permissions } = useSuspenseQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: getPermissionsAction,
    initialData: [],
    refetchOnMount: 'always',
  });

  if (id && !role) {
    return null;
  }

  const handleSubmit = async (formData: FormData) => {
    const selectedPermissions = permissions.filter((item) => formData.get(`permission:${item}`) === 'on');

    formData.append('permissions', JSON.stringify(selectedPermissions));

    const result = await formDispatch(formData);

    queryClient.invalidateQueries({
      queryKey: ['role', id],
    });

    return result;
  };

  const handleDelete = async () => {
    if (!id) return;

    const confirmDelete = window.confirm(t('role.delete_confirm'));
    if (!confirmDelete) return;

    const formData = new FormData();
    formData.append('id', id);

    const result = await deleteRoleAction({ success: false }, formData);

    if (result.success) {
      router.push('../roles');
    } else {
      console.error(result.message);
    }
  };

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      {state.message && (
        <Alert className='mb-6' color={state.success ? 'success' : 'failure'}>
          {state.message}
        </Alert>
      )}
      <div className='space-y-6'>
        <div className='flex justify-between items-center'>
          <h5 className='card-title text-dark dark:text-white'>{id ? t('role.update') : t('role.create')}</h5>
        </div>
        <form action={handleSubmit} className='flex flex-col gap-4'>
          <input type='hidden' name='id' value={role?.id} />
          <div>
            <Label htmlFor='name' className='flex items-center gap-2 text-base'>
              {t('role.name')}
            </Label>
            <TextInput id='name' name='name' type='text' defaultValue={role?.name || ''} className='mt-2' required />
          </div>
          <div>
            <Label htmlFor='description' className='flex items-center gap-2 text-base'>
              {t('role.description')}
            </Label>
            <TextInput
              id='description'
              name='description'
              type='text'
              defaultValue={role?.description || ''}
              className='mt-2'
            />
          </div>
          <div>
            <Label className='flex items-center gap-2 text-base mb-3'>{t('role.permissions')}</Label>
            <div className='flex flex-wrap gap-4'>
              {permissions.map((permission) => (
                <div key={permission} className='flex items-center gap-2'>
                  <Checkbox
                    id={`permission:${permission}`}
                    name={`permission:${permission}`}
                    defaultChecked={role?.permissions?.includes(permission)}
                  />
                  <Label
                    htmlFor={`permission:${permission}`}
                    className='text-sm font-medium text-gray-900 dark:text-white'
                  >
                    {permission}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className='flex justify-end'>
            <div className='flex items-center gap-4'>
              {id && (
                <Button color='failure' onClick={handleDelete}>
                  {t('delete')}
                </Button>
              )}
              <Button type='submit' color='primary' disabled={pending}>
                {t('save')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Renders the Role Form UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const RoleForm = ({ id }: RoleFormProps) => {
  return (
    <Suspense fallback={<RoleFormSkeleton />}>
      <RoleFormContent id={id} />
    </Suspense>
  );
};
