'use client';
import React, { useEffect, useState } from 'react';

import { Icon } from '@iconify/react';
import { Navbar, Drawer, DrawerItems } from 'flowbite-react';

import CopyTokenButton from '@/shared/components/common/CopyTokenButton';

import MobileSidebar from '../sidebar/MobileSidebar';
import Notification from './Notification';
import Profile from './Profile';

/**
 * Renders the Header UI for the dashboard header.
 * @returns Rendered React element for this view.
 */
const Header = () => {
  const [isSticky, setIsSticky] = useState(false);

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
      <header className={`sticky top-0 z-5 ${isSticky ? 'bg-white dark:bg-dark fixed w-full' : 'bg-white'}`}>
        <Navbar fluid className='rounded-none bg-white dark:bg-dark py-4 sm:px-6 px-4'>
          <div className='flex gap-3 items-center justify-between w-full'>
            <div className='flex gap-2 items-center'>
              <span
                onClick={() => setIsOpen(true)}
                className='h-10 w-10 flex text-black dark:text-white text-opacity-65 xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer'
              >
                <Icon icon='solar:hamburger-menu-line-duotone' height={21} />
              </span>
              <Notification />
              {process.env.NODE_ENV === 'development' && <CopyTokenButton />}
            </div>

            <div className='flex gap-4 items-center'>
              <Profile />
            </div>
          </div>
        </Navbar>
      </header>

      {/* Mobile Sidebar */}
      <Drawer open={isOpen} onClose={handleClose} className='w-64'>
        <DrawerItems>
          <MobileSidebar />
        </DrawerItems>
      </Drawer>
    </>
  );
};

export default Header;
