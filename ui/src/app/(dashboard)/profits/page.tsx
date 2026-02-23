'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';

import { TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { ForbiddenError } from '@/app/(dashboard)/_shared/errors/ForbiddenError';
import { ProfitTable } from '@/app/(dashboard)/profits/_components/ProfitTable';
import { Permission } from '@/shared/types/permission.types';

const ProfitPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const next = searchParams.get('email') ?? '';
    if (next !== searchTerm) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchTerm(next);
    }
  }, [searchParams, searchTerm]);

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
  );
};

const Page: React.FC = () => {
  return (
    <PermissionGuard permissions={[Permission.VIEW_PROFIT]} fallback={<ForbiddenError />}>
      <Suspense>
        <ProfitPageContent />
      </Suspense>
    </PermissionGuard>
  );
};

export default Page;
