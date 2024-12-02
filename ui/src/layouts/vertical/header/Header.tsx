'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { Icon } from '@iconify/react';
import { Navbar } from 'flowbite-react';
import { Drawer } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';

import MobileSidebar from '../sidebar/MobileSidebar';
import Notification from './Notification';
import Profile from './Profile';

const Header = () => {
  const [isSticky, setIsSticky] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => setIsOpen(false);
  return (
    <>
      <header className={`sticky top-0 z-[5] ${isSticky ? 'bg-white dark:bg-dark fixed w-full' : 'bg-white'}`}>
        <Navbar fluid className='rounded-none bg-white dark:bg-dark py-4 sm:px-30 px-4'>
          <div className='flex gap-3 items-center justify-between w-full'>
            <div className='flex gap-2 items-center'>
              <span
                onClick={() => setIsOpen(true)}
                className='h-10 w-10 flex text-black dark:text-white text-opacity-65 xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer'
              >
                <Icon icon='solar:hamburger-menu-line-duotone' height={21} />
              </span>
              <PermissionGuard permissions={['manage:users']}>
                <Link
                  href='/admin'
                  className='h-10 w-10 flex text-black dark:text-white text-opacity-65 hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer'
                  title={t('menu.admin')}
                >
                  <Icon icon='solar:settings-line-duotone' height={21} />
                </Link>
              </PermissionGuard>
              <Notification />
            </div>

            <div className='flex gap-4 items-center'>
              <Profile />
            </div>
          </div>
        </Navbar>
      </header>

      {/* Mobile Sidebar */}
      <Drawer open={isOpen} onClose={handleClose} className='w-130'>
        <Drawer.Items>
          <MobileSidebar />
        </Drawer.Items>
      </Drawer>
    </>
  );
};

export default Header;
