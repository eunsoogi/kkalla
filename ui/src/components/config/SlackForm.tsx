'use client';

import Link from 'next/link';
import React, { Suspense, memo, useActionState } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Label, TextInput, Tooltip } from 'flowbite-react';
import { useFormStatus } from 'react-dom';

import { ApikeyStatus } from '@/enums/apikey.enum';
import { SlackConfig, initialState as initialConfigState } from '@/interfaces/slack.interface';
import { initialState } from '@/interfaces/state.interface';

import { getSlackConfigAction, getSlackStatusAction, postSlackConfigAction } from './action';
import { STATUS_STYLES } from './style';

const configQueryKey = ['slack', 'config'];
const badgeQueryKey = ['slack', 'status'];

const SlackStatusBadge: React.FC = () => {
  const { data } = useSuspenseQuery<ApikeyStatus>({
    queryKey: badgeQueryKey,
    queryFn: getSlackStatusAction,
    initialData: ApikeyStatus.UNKNOWN,
    staleTime: 0,
  });

  return <Badge className={STATUS_STYLES[data]}>{data}</Badge>;
};

const SlackStatusBadgeSkeleton: React.FC = () => {
  return <Badge className={STATUS_STYLES.unknown}>{ApikeyStatus.UNKNOWN}</Badge>;
};

const SlackFormItem = memo(() => {
  const { data } = useSuspenseQuery<SlackConfig>({
    queryKey: configQueryKey,
    queryFn: getSlackConfigAction,
    initialData: initialConfigState,
    staleTime: 0,
    select: (data) => ({
      channel: data.channel ?? '',
    }),
  });

  return (
    <>
      <FormGroup title='토큰'>
        <TextInput id='slackToken' name='token' type='text' required className='form-control form-rounded-xl' />
      </FormGroup>

      <FormGroup title='채널'>
        <TextInput
          id='slackChannel'
          name='channel'
          type='text'
          defaultValue={data.channel}
          required
          className='form-control form-rounded-xl'
        />
      </FormGroup>
    </>
  );
});

SlackFormItem.displayName = 'SlackFormItem';

const FormGroup = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className='lg:col-span-6 col-span-12'>
    <div className='flex flex-col gap-4'>
      <div>
        <div className='mb-2 block'>
          <Label value={title} />
        </div>
        {children}
      </div>
    </div>
  </div>
));

FormGroup.displayName = 'FormGroup';

const SlackFormItemSkeleton: React.FC = () => {
  return <div className='flex'>로딩 중...</div>;
};

const SlackForm: React.FC = () => {
  const queryClient = useQueryClient();
  const [formState, formDispatch] = useActionState(postSlackConfigAction, initialState);
  const { pending } = useFormStatus();

  const handleSubmit = async (payload: FormData) => {
    formDispatch(payload);
    queryClient.invalidateQueries({
      queryKey: ['slack'],
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
        <div className='flex flex-column items-center gap-2'>
          <h5 className='card-title'>Slack</h5>
          <Tooltip content='Slack 메시지를 보내기 위한 봇 토큰입니다. 클릭하면 매뉴얼 페이지로 이동합니다.'>
            <Link href='https://api.slack.com/apps' target='_blank'>
              <Icon icon='solar:info-circle-outline' height='1.125rem' className='text-dark' />
            </Link>
          </Tooltip>
          <Suspense fallback={<SlackStatusBadgeSkeleton />}>
            <SlackStatusBadge />
          </Suspense>
        </div>
        <div className='mt-6'>
          <div className='grid grid-cols-12 gap-y-30 lg:gap-x-30'>
            <Suspense fallback={<SlackFormItemSkeleton />}>
              <SlackFormItem />
            </Suspense>
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

export default SlackForm;