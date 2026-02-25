import { useTranslations } from 'next-intl';

import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/shared/types/permission.types';

interface BaseChildItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface LeafChildItem extends BaseChildItem {
  url: string;
  children?: never;
}

export interface CollapseChildItem extends BaseChildItem {
  icon: string;
  children: ChildItem[];
  url?: never;
}

export type ChildItem = LeafChildItem | CollapseChildItem;

export interface MenuItem {
  id: string;
  heading: string;
  children: ChildItem[];
}

/**
 * Handles sidebar content in the dashboard sidebar workflow.
 * @returns Processed collection for downstream workflow steps.
 */
export const SidebarContent = (): MenuItem[] => {
  const t = useTranslations('menu');
  const { hasPermission } = usePermissions();

  const menuItems: MenuItem[] = [
    {
      id: 'home',
      heading: t('home'),
      children: [
        {
          id: 'dashboard',
          name: t('dashboard'),
          icon: 'solar:widget-add-line-duotone',
          url: '/',
        },
      ],
    },
    {
      id: 'service',
      heading: t('service'),
      children: [
        {
          id: 'news',
          name: t('newsList'),
          icon: 'solar:document-outline',
          url: '/news',
        },
        {
          id: 'market-signals',
          name: t('marketReport'),
          icon: 'solar:chart-line-duotone',
          url: '/market-signals',
        },
        {
          id: 'allocation-recommendations',
          name: t('allocationReport'),
          icon: 'solar:chart-line-duotone',
          url: '/allocation-recommendations',
        },
        {
          id: 'trades',
          name: t('tradeList'),
          icon: 'uil:exchange',
          url: '/trades',
        },
      ],
    },
    {
      id: 'config',
      heading: t('config'),
      children: [
        {
          id: 'register',
          name: t('register'),
          icon: 'solar:chat-round-money-bold',
          url: '/register',
        },
        {
          id: 'notify',
          name: t('notify'),
          icon: 'solar:bell-bold',
          url: '/notify',
        },
      ],
    },
  ];

  const adminChildren: ChildItem[] = [];

  if (hasPermission(['manage:users'])) {
    adminChildren.push(
      {
        id: 'users',
        name: t('userManagement'),
        icon: 'solar:users-group-rounded-line-duotone',
        url: '/users',
      },
      {
        id: 'roles',
        name: t('roleManagement'),
        icon: 'solar:shield-user-line-duotone',
        url: '/roles',
      },
    );
  }

  if (hasPermission([Permission.VIEW_PROFIT])) {
    adminChildren.push({
      id: 'profits',
      name: t('profitManagement'),
      icon: 'solar:money-bag-line-duotone',
      url: '/profits',
    });
  }

  if (hasPermission([Permission.VIEW_BLACKLISTS])) {
    adminChildren.push({
      id: 'blacklists',
      name: t('blacklistManagement'),
      icon: 'solar:forbidden-circle-line-duotone',
      url: '/blacklists',
    });
  }

  const hasScheduleAccess = hasPermission([
    Permission.EXEC_SCHEDULE_MARKET_SIGNAL,
    Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_EXISTING,
    Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_NEW,
    Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT,
  ]);

  if (hasScheduleAccess) {
    adminChildren.push({
      id: 'schedules',
      name: t('scheduleManagement'),
      icon: 'solar:calendar-mark-line-duotone',
      url: '/schedules',
    });
  }

  if (hasPermission([Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT])) {
    adminChildren.push({
      id: 'allocation-audits',
      name: t('allocationAudit'),
      icon: 'solar:checklist-minimalistic-line-duotone',
      url: '/allocation-audits',
    });
  }

  if (adminChildren.length > 0) {
    menuItems.push({
      id: 'admin',
      heading: t('admin'),
      children: adminChildren,
    });
  }

  return menuItems;
};
