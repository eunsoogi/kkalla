'use client';

import React, { useActionState } from 'react';

import { Alert, Button, Label, TextInput } from 'flowbite-react';
import { useFormStatus } from 'react-dom';

import { postApikeyAction } from './actions';
import { initialState } from './state';

const Page = () => {
  const [formState, formDispatch] = useActionState(postApikeyAction, initialState);
  const { pending } = useFormStatus();

  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words'>
        {formState.message && (
          <Alert className='mb-6' color={formState.success ? 'success' : 'failure'}>
            {formState.message}
          </Alert>
        )}
        <form action={formDispatch} className='mb-6'>
          <input type='hidden' name='type' value='OPENAI' />
          <h5 className='card-title'>OpenAI</h5>
          <div className='mt-6'>
            <div className='grid grid-cols-12 gap-30'>
              <div className='lg:col-span-6 col-span-12'>
                <div className='flex flex-col gap-4'>
                  <div>
                    <div className='mb-2 block'>
                      <Label htmlFor='openaiApiKey' value='API 키' />
                    </div>
                    <TextInput
                      id='openaiApiKey'
                      name='apiKey'
                      type='text'
                      required
                      className='form-control form-rounded-xl'
                    />
                  </div>
                </div>
              </div>
              <div className='col-span-12 flex gap-3'>
                <Button type='submit' color={'primary'} disabled={pending}>
                  저장
                </Button>
              </div>
            </div>
          </div>
        </form>
        <form action={formDispatch} className='mb-6'>
          <input type='hidden' name='type' value='UPBIT' />
          <h5 className='card-title'>업비트</h5>
          <div className='mt-6'>
            <div className='grid grid-cols-12 gap-30'>
              <div className='lg:col-span-6 col-span-12'>
                <div className='flex flex-col gap-4'>
                  <div>
                    <div className='mb-2 block'>
                      <Label htmlFor='upbitApiKey' value='API 키' />
                    </div>
                    <TextInput
                      id='upbitApiKey'
                      name='apiKey'
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
              <div className='col-span-12 flex gap-3'>
                <Button type='submit' color={'primary'} disabled={pending}>
                  저장
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default Page;
