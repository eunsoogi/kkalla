import { usePathname } from 'next/navigation';
import React from 'react';

import { Icon } from '@iconify/react';
import { SidebarCollapse, SidebarItemGroup } from 'flowbite-react';
import { twMerge } from 'tailwind-merge';

import NavItems from '../NavItems';
import { ChildItem } from '../Sidebaritems';

interface NavCollapseProps {
  item: ChildItem;
}

const NavCollapse: React.FC<NavCollapseProps> = ({ item }: any) => {
  const pathname = usePathname();
  const activeDD = item.children.find((t: { url: string }) => t.url === pathname);

  return (
    <>
      <SidebarCollapse
        label={item.name}
        open={activeDD ? true : false}
        icon={() => <Icon icon={item.icon} height={18} />}
        className={`${activeDD ? '!text-primary bg-lightprimary ' : ''} collapse-menu`}
        renderChevronIcon={(theme: any, open: boolean) => (
          <Icon
            icon='material-symbols:menu'
            className={`${twMerge(theme.label.icon.open[open ? 'on' : 'off'])} drop-icon`}
            width={20}
            height={20}
          />
        )}
      >
        {/* Render child items */}
        {item.children && (
          <SidebarItemGroup className='sidebar-dropdown'>
            {item.children.map((child: any) => (
              <React.Fragment key={child.id}>
                {/* Render NavItems for child items */}
                {child.children ? (
                  <NavCollapse item={child} /> // Recursive call for nested collapse
                ) : (
                  <NavItems item={child} />
                )}
              </React.Fragment>
            ))}
          </SidebarItemGroup>
        )}
      </SidebarCollapse>
    </>
  );
};

export default NavCollapse;
