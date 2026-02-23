'use client';
import React from 'react';

import AuthLogin from '@/app/(auth)/signin/_components/AuthLogin';
import FullLogo from '@/layouts/shared/logo/FullLogo';

const gradientStyle = {
  background:
    'linear-gradient(45deg, rgb(238, 119, 82,0.2), rgb(231, 60, 126,0.2), rgb(35, 166, 213,0.2), rgb(35, 213, 171,0.2))',
  backgroundSize: '400% 400%',
  animation: 'gradient 15s ease infinite',
  height: '100vh',
};

/**
 * Renders the Boxed Login UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const BoxedLogin = () => {
  return (
    <div style={gradientStyle} className='relative overflow-hidden h-screen'>
      <div className='flex h-full justify-center items-center px-4'>
        <div className='rounded-xl shadow-md bg-white dark:bg-dark p-6 w-full md:w-96 border-none'>
          <div className='flex flex-col gap-2 p-0 w-full'>
            <div className='mx-auto'>
              <FullLogo />
            </div>
            <AuthLogin />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoxedLogin;
