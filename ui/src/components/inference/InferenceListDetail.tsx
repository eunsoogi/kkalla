'use client';

import Image from 'next/image';
import React, { Suspense } from 'react';

import { Badge } from 'flowbite-react';
import { TbPoint } from 'react-icons/tb';

import { formatDate } from '@/utils/date';

import { useInferencesSuspenseQuery } from './hook';
import { DECISION_STYLES } from './style';
import { Inference } from './type';
import userImage1 from '/public/images/profile/user-1.jpg';

const InferenceContent = () => {
  const { data } = useInferencesSuspenseQuery();

  return data.items.map((item: Inference) => (
    <div
      key={item.id}
      className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray mb-30 p-0 relative w-full break-words'
    >
      <div className='relative'>
        <Image
          src={userImage1}
          className='h-10 w-10 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
          alt='user'
        />
      </div>
      <div className='p-6'>
        <div className='flex gap-6 mt-6'>
          <Badge color={'muted'} className={DECISION_STYLES[item.decision].badgeStyle}>
            {item.decision}
          </Badge>
          <h4>{item.rate * 100}%</h4>
        </div>
        <div className='grid grid-cols-12 gap-x-30'>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>추론 내용</h4>
            <div className='my-3 lg:line-clamp-4'>{item.reason}</div>
          </div>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>회귀 내용</h4>
            <div className='my-3 lg:line-clamp-4'>{item.reflection}</div>
          </div>
        </div>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <TbPoint size={15} className='text-dark' />
            <span className='text-sm text-darklink'>{formatDate(new Date(item.createdAt))}</span>
          </div>
        </div>
      </div>
    </div>
  ));
};

const InferenceSkeleton = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray mb-30 p-0 relative w-full break-words overflow-hidden'>
      <div className='px-6 pb-6'>
        <div className='grid grid-cols-12 gap-x-30'>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>추론 내용</h4>
            <div className='my-3 lg:line-clamp-4'>없음</div>
          </div>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>회귀 내용</h4>
            <div className='my-3 lg:line-clamp-4'>없음</div>
          </div>
        </div>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <TbPoint size={15} className='text-dark' />
            <span className='text-sm text-darklink'>{formatDate(new Date())}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InferenceListDetail = () => {
  return (
    <Suspense fallback={<InferenceSkeleton />}>
      <InferenceContent />
    </Suspense>
  );
};

export default InferenceListDetail;