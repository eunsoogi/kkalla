import React from 'react';

import { Button } from 'flowbite-react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';

const DEFAULT_CALLBACK_URL = '/';

const AuthLogin: React.FC = () => {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? DEFAULT_CALLBACK_URL;

  return (
    <Button
      color={'primary'}
      onClick={() => signIn('google', { callbackUrl })}
      className='w-full bg-primary text-white rounded-xl'
    >
      {t('auth.signin.google')}
    </Button>
  );
};

export default AuthLogin;
