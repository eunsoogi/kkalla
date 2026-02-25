import { usePathname } from 'next/navigation';
import React from 'react';

import { Icon } from '@iconify/react';
import { SidebarCollapse, SidebarItemGroup } from 'flowbite-react';
import { twMerge } from 'tailwind-merge';

import NavItems from '../NavItems';
import { ChildItem, CollapseChildItem } from '../Sidebaritems';

interface NavCollapseProps {
  item: CollapseChildItem;
}

const isCollapseChild = (child: ChildItem): child is CollapseChildItem =>
  Array.isArray((child as CollapseChildItem).children);

const hasActivePath = (children: ChildItem[], pathname: string): boolean =>
  children.some((child) => (isCollapseChild(child) ? hasActivePath(child.children, pathname) : child.url === pathname));

const NavCollapse: React.FC<NavCollapseProps> = ({ item }) => {
  const pathname = usePathname();
  const isActive = hasActivePath(item.children, pathname);

  return (
    <>
      <SidebarCollapse
        label={item.name}
        open={isActive}
        icon={() => <Icon icon={item.icon} height={18} />}
        className={`${isActive ? '!text-primary bg-lightprimary ' : ''} collapse-menu`}
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
        <SidebarItemGroup className='sidebar-dropdown'>
          {item.children.map((child) => (
            <React.Fragment key={child.id}>
              {/* Render NavItems for child items */}
              {isCollapseChild(child) ? (
                <NavCollapse item={child} /> // Recursive call for nested collapse
              ) : (
                <NavItems item={child} />
              )}
            </React.Fragment>
          ))}
        </SidebarItemGroup>
      </SidebarCollapse>
    </>
  );
};

export default NavCollapse;
