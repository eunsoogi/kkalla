'use client';

import Link from 'next/link';
import React, { Suspense, useActionState } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Label, TextInput, Tooltip } from 'flowbite-react';
import { useFormStatus } from 'react-dom';

import { ApikeyStatus, ApikeyTypes } from '@/enums/apikey.enum';
import { initialState } from '@/interfaces/state.interface';

import { getApikeyAction, postApikeyAction } from './action';
import { STATUS_STYLES } from './style';

const badgeQueryKey = ['apikey', 'status', ApikeyTypes.UPBIT];

const UpbitStatusBadge: React.FC = () => {
  const { data } = useSuspenseQuery<ApikeyStatus>({
    queryKey: badgeQueryKey,
    queryFn: () => getApikeyAction(ApikeyTypes.UPBIT),
    initialData: ApikeyStatus.UNKNOWN,
    staleTime: 0,
  });

  return <Badge className={STATUS_STYLES[data]}>{data}</Badge>;
};

const UpbitStatusBadgeSkeleton: React.FC = () => {
  return <Badge className={STATUS_STYLES.unknown}>{ApikeyStatus.UNKNOWN}</Badge>;
};

const UpbitForm: React.FC = () => {
  const queryClient = useQueryClient();
  const [formState, formDispatch] = useActionState(postApikeyAction, initialState);
  const { pending } = useFormStatus();

  const handleSubmit = async (payload: FormData) => {
    await formDispatch(payload);
    queryClient.invalidateQueries({
      queryKey: badgeQueryKey,
    });
  };

  return (
    <>
      {formState.message && (
        <Alert className='mb-6' color={formState.success ? 'success' : 'failure'}>
          {formState.message}
        </Alert>
      )}
      <form action={handleSubmit}>
        <input type='hidden' name='type' value='UPBIT' />
        <div className='flex flex-column items-center gap-2'>
          <h5 className='card-title'>업비트</h5>
          <Tooltip content='업비트 주문을 호출하기 위한 업비트 API 키입니다. 클릭하면 매뉴얼 페이지로 이동합니다.'>
            <Link href='https://upbit.com/service_center/open_api_guide' target='_blank'>
              <Icon icon='solar:info-circle-outline' height='1.125rem' className='text-dark' />
            </Link>
          </Tooltip>
          <Suspense fallback={<UpbitStatusBadgeSkeleton />}>
            <UpbitStatusBadge />
          </Suspense>
        </div>
        <div className='border-l-4 border-gray-300 dark:border-gray-500 mt-6 pl-6'>
          이 API 키는 자산조회, 주문하기 권한이 필요합니다.
        </div>
        <div className='mt-6'>
          <div className='grid grid-cols-12 gap-y-30 lg:gap-x-30'>
            <div className='lg:col-span-6 col-span-12'>
              <div className='flex flex-col gap-4'>
                <div>
                  <div className='mb-2 block'>
                    <Label htmlFor='upbitAccessKey' value='액세스 키' />
                  </div>
                  <TextInput
                    id='upbitAccessKey'
                    name='accessKey'
                    type='text'
                    required
                    className='form-control form-rounded-xl'
                  />
                </div>
              </div>
            </div>
            <div className='lg:col-span-6 col-span-12'>
              <div className='flex flex-col gap-4'>
                <div>
                  <div className='mb-2 block'>
                    <Label htmlFor='upbitSecretKey' value='비밀 키' />
                  </div>
                  <TextInput
                    id='upbitSecretKey'
                    name='secretKey'
                    type='text'
                    required
                    className='form-control form-rounded-xl'
                  />
                </div>
              </div>
            </div>
            <div className='flex col-span-12'>
              <Button type='submit' color={'primary'} disabled={pending}>
                저장
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default UpbitForm;
