'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

import { TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { ProfitTable } from '@/components/profit/ProfitTable';
import { Permission } from '@/interfaces/permission.interface';

const Page: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm(searchParams.get('email') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchTerm) {
        params.set('email', searchTerm);
      } else {
        params.delete('email');
      }
      params.set('page', '1');
      router.push(`?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, router, searchParams]);

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', page.toString());
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <PermissionGuard permissions={[Permission.VIEW_PROFIT]} fallback={<ForbiddenError />}>
      <div className='space-y-4'>
        <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
          <div className='px-6'>
            <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.profitManagement')}</h5>
            <div className='grid grid-cols-12 mb-4'>
              <div className='lg:col-span-3 col-span-12'>
                <TextInput
                  type='text'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('user.email')}
                />
              </div>
            </div>
          </div>
          <ProfitTable
            page={Number(searchParams.get('page')) || 1}
            email={searchParams.get('email') || undefined}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </PermissionGuard>
  );
};

export default Page;
