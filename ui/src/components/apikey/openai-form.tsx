'use client';

import React, { useActionState } from 'react';

import { Alert, Button, Label, TextInput } from 'flowbite-react';
import { useFormStatus } from 'react-dom';

import { POST } from '@/app/api/v1/apikeys/route';
import { initialState } from '@/interfaces/state.interface';

const OpenaiForm = () => {
  const [formState, formDispatch] = useActionState(POST, initialState);
  const { pending } = useFormStatus();

  return (
    <>
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
                    <Label htmlFor='openaiSecretKey' value='비밀 키' />
                  </div>
                  <TextInput
                    id='openaiSecretKey'
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
    </>
  );
};

export default OpenaiForm;
