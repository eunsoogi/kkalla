'use client';

import React, { Suspense, useActionState, useCallback, useTransition } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Checkbox, Label } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { twMerge } from 'tailwind-merge';

import { Category as CategoryEnum } from '@/enums/category.enum';
import { usePermissions } from '@/hooks/usePermissions';
import { Category } from '@/interfaces/category.interface';
import { getCategoryPermission, getCategoryText } from '@/utils/category';

import { getCategoriesAction, updateCategoryAction } from './action';

const CategoryFormSkeleton = () => {
  return (
    <div className='space-y-6 animate-pulse'>
      <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
      <div className='space-y-4'>
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
  );
};

const CategoryFormContent = () => {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [formState, formAction] = useActionState(updateCategoryAction, {
    success: false,
    message: '',
  });
  const { hasPermission } = usePermissions();

  const { data: userCategories, refetch } = useSuspenseQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getCategoriesAction,
    initialData: [],
    staleTime: 0,
  });

  const allCategories = Object.values(CategoryEnum);

  const handleCategoryChange = useCallback(
    (categoryEnum: CategoryEnum, checked: boolean) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.append('category', categoryEnum);
        formData.append('enabled', checked.toString());
        await formAction(formData);
        refetch();
      });
    },
    [formAction, refetch],
  );

  return (
    <>
      {!isPending && formState.message && (
        <Alert className='mb-6' color={formState.success ? 'success' : 'failure'}>
          {formState.message}
        </Alert>
      )}
      <form>
        <div className='flex flex-column items-center gap-2'>
          <h5 className='card-title text-dark dark:text-white'>{t('category.title')}</h5>
        </div>
        <div className='mt-6'>
          <div className='space-y-4'>
            <div>
              <Label>{t('category.label')}</Label>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-4'>{t('category.description')}</p>
              <div className='flex flex-wrap gap-4 mt-2'>
                {allCategories.map((categoryEnum) => {
                  const userCategory = userCategories.find((uc) => uc.category === categoryEnum);
                  const requiredPermission = getCategoryPermission(categoryEnum);
                  const hasRequiredPermission = !requiredPermission || hasPermission([requiredPermission]);

                  return (
                    <div key={categoryEnum} className='flex items-center gap-2'>
                      <div className={twMerge('flex items-center gap-2', !hasRequiredPermission && 'opacity-50')}>
                        <Checkbox
                          id={`category:${categoryEnum}`}
                          name={`category:${categoryEnum}`}
                          checked={userCategory?.enabled ?? false}
                          disabled={isPending || !hasRequiredPermission}
                          onChange={(e) => handleCategoryChange(categoryEnum, e.target.checked)}
                        />
                        <Label htmlFor={`category:${categoryEnum}`}>{getCategoryText(categoryEnum, t)}</Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default function CategoryForm() {
  return (
    <Suspense fallback={<CategoryFormSkeleton />}>
      <CategoryFormContent />
    </Suspense>
  );
}
