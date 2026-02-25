'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

import { Icon } from '@iconify/react';
import { SidebarItem } from 'flowbite-react';

import { LeafChildItem } from '../Sidebaritems';

interface NavItemsProps {
  item: LeafChildItem;
}
const NavItems: React.FC<NavItemsProps> = ({ item }) => {
  const pathname = usePathname();
  return (
    <>
      <SidebarItem
        href={item.url}
        as={Link}
        className={`${
          item.url == pathname ? '!text-white bg-primary shadow-active' : 'text-link bg-transparent group/link '
        } `}
      >
        <span className='flex gap-3 align-center items-center truncate'>
          {item.icon ? (
            <Icon icon={item.icon} className={`${item.color}`} height={18} />
          ) : (
            <span
              className={`${
                item.url == pathname
                  ? 'dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary !bg-primary h-[6px] w-[6px]'
                  : 'h-[6px] w-[6px] bg-darklink dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary'
              } `}
            ></span>
          )}
          <span className='max-w-36 overflow-hidden hide-menu'>{item.name}</span>
        </span>
      </SidebarItem>
    </>
  );
};

export default NavItems;
