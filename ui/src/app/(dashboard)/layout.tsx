'use client';

import React from 'react';

import Header from '../../components/layouts/vertical/header/Header';
import Sidebar from '../../components/layouts/vertical/sidebar/Sidebar';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='flex w-full min-h-screen'>
      <div className='page-wrapper flex w-full'>
        {/* Header/sidebar */}
        <Sidebar />
        <div className='body-wrapper w-full bg-white dark:bg-dark'>
          <Header />
          {/* Body Content  */}
          <div className='bg-lightgray mr-3 rounded-page min-h-[90vh]'>
            <div className={`container mx-auto  py-30`}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
