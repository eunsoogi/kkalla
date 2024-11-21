'use client';

import Link from 'next/link';
import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Inference, initialPaginatedState } from '@/interfaces/inference.interface';
import { PaginatedItem } from '@/interfaces/item.interface';

import { InferenceItem, InferenceSkeleton } from './InferenceItem';
import { getInferenceAction } from './action';

const InferenceListContent: React.FC = () => {
  const { data } = useSuspenseQuery<PaginatedItem<Inference>>({
    queryKey: ['inferences'],
    queryFn: () => getInferenceAction({ mine: true }),
    initialData: initialPaginatedState,
    staleTime: 0,
  });

  return <ul>{data.items?.map((item: Inference) => <InferenceItem key={item.id} {...item} />)}</ul>;
};

export const InferenceList: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      <h5 className='card-title text-dark dark:text-white mb-6'>
        <Link href='/inferences'>{t('inference.list')}</Link>
      </h5>
      <div className='flex flex-col mt-2'>
        <Suspense fallback={<InferenceSkeleton />}>
          <InferenceListContent />
        </Suspense>
      </div>
    </div>
  );
};
