'use client';

import React from 'react';

import Header from '@/layouts/vertical/header/Header';
import Sidebar from '@/layouts/vertical/sidebar/Sidebar';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='flex w-full min-h-screen bg-white dark:bg-dark'>
      <div className='page-wrapper flex w-full min-w-0'>
        {/* Header/sidebar */}
        <Sidebar />
        <div className='body-wrapper w-full min-w-0'>
          <Header />
          {/* Body Content  */}
          <div className='bg-lightgray dark:bg-gray-800 xl:mr-3 rounded-[20px] min-h-[90vh] w-full min-w-0'>
            <div className='w-full max-w-[100%] min-w-0 p-4 lg:p-8'>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
