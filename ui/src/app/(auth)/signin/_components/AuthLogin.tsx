import React from 'react';

import { Button } from 'flowbite-react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';

const AuthLogin: React.FC = () => {
  const t = useTranslations();

  return (
    <Button
      color={'primary'}
      onClick={() => signIn('google', { callbackUrl: '/' })}
      className='w-full bg-primary text-white rounded-xl'
    >
      {t('auth.signin.google')}
    </Button>
  );
};

export default AuthLogin;
