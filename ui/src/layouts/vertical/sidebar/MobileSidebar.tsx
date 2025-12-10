'use client';

import React from 'react';

import { Icon } from '@iconify/react';
import { Sidebar, SidebarItems, SidebarItemGroup } from 'flowbite-react';
import SimpleBar from 'simplebar-react';

import FullLogo from '../../shared/logo/FullLogo';
import NavCollapse from './NavCollapse';
import NavItems from './NavItems';
import { SidebarContent } from './Sidebaritems';

const MobileSidebar = () => {
  const sidebarContent = SidebarContent();

  return (
    <div className='flex'>
      <Sidebar
        className='fixed menu-sidebar bg-white dark:bg-dark z-10'
        aria-label='Sidebar with multi-level dropdown example'
      >
        <div className='px-4 py-3 brand-logo'>
          <FullLogo />
        </div>

        <SimpleBar className='h-[calc(100vh-100px)]'>
          <SidebarItems className='px-4 mb-12'>
            <SidebarItemGroup className='sidebar-nav'>
              {sidebarContent.map((item, index) => (
                <React.Fragment key={index}>
                  <h5 className='text-link text-xs caption'>
                    <span className='hide-menu'>{item.heading}</span>
                  </h5>
                  <Icon
                    icon='solar:menu-dots-bold'
                    className='text-ld block mx-auto mt-6 leading-6 dark:text-opacity-60 hide-icon'
                    height={18}
                  />

                  {item.children?.map((child, index) => (
                    <React.Fragment key={child.id && index}>
                      {child.children ? (
                        <div className='collpase-items'>
                          <NavCollapse item={child} />
                        </div>
                      ) : (
                        <NavItems item={child} />
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </SidebarItemGroup>
          </SidebarItems>
        </SimpleBar>
      </Sidebar>
    </div>
  );
};

export default MobileSidebar;
