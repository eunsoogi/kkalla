'use client';

import React, { Suspense, memo, useActionState } from 'react';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Label, TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { ApikeyStatus } from '@/enums/apikey.enum';
import { SlackConfig, initialState as initialConfigState } from '@/app/(dashboard)/notify/_types/slack.types';
import { initialState } from '@/shared/types/action-state.types';

import { getSlackConfigAction, getSlackStatusAction, postSlackConfigAction } from '@/app/(dashboard)/_shared/settings/_actions/settings.actions';
import { STATUS_STYLES } from '@/app/(dashboard)/_shared/settings/settings.styles';

const configQueryKey = ['slack', 'config'];
const badgeQueryKey = ['slack', 'status'];

const SlackStatusBadge: React.FC = () => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<ApikeyStatus>({
    queryKey: badgeQueryKey,
    queryFn: getSlackStatusAction,
    initialData: ApikeyStatus.UNKNOWN,
    refetchOnMount: 'always',
  });

  return <Badge className={STATUS_STYLES[data]}>{t(`status.${data}`)}</Badge>;
};

const SlackStatusBadgeSkeleton: React.FC = () => {
  const t = useTranslations();

  return <Badge className={STATUS_STYLES.unknown}>{t('status.unknown')}</Badge>;
};

const SlackFormItem = memo(() => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<SlackConfig>({
    queryKey: configQueryKey,
    queryFn: getSlackConfigAction,
    initialData: initialConfigState,
    refetchOnMount: 'always',
    select: (data) => ({
      channel: data.channel ?? '',
    }),
  });

  return (
    <>
      <FormGroup title={t('token')}>
        <TextInput id='slackToken' name='token' type='text' required className='form-control form-rounded-xl' />
      </FormGroup>

      <FormGroup title={t('channel')}>
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
          <Label>{title}</Label>
        </div>
        {children}
      </div>
    </div>
  </div>
));

FormGroup.displayName = 'FormGroup';

const SlackFormItemSkeleton: React.FC = () => {
  const t = useTranslations();

  return <div className='flex'>{t('loading')}</div>;
};

const SlackForm: React.FC = () => {
  const t = useTranslations();
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
        <div className='flex flex-col items-start gap-2 text-left w-full'>
          <h5 className='card-title text-dark dark:text-white'>{t('slack.register')}</h5>
          <Suspense fallback={<SlackStatusBadgeSkeleton />}>
            <SlackStatusBadge />
          </Suspense>
        </div>
        <div className='mt-6'>
          <div className='grid grid-cols-12 gap-y-6 lg:gap-x-6'>
            <Suspense fallback={<SlackFormItemSkeleton />}>
              <SlackFormItem />
            </Suspense>
            <div className='flex col-span-12'>
              <Button type='submit' color={'primary'} disabled={pending}>
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default SlackForm;
