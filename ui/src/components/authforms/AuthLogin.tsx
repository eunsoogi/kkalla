import React from 'react';

import { Button } from 'flowbite-react';
import { signIn } from 'next-auth/react';

const AuthLogin = () => {
  return (
    <Button
      color={'primary'}
      onClick={() => signIn('google', { callbackUrl: '/' })}
      className='w-full bg-primary text-white rounded-xl'
    >
      구글로 로그인
    </Button>
  );
};

export default AuthLogin;
