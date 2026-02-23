import { uniqueId } from 'lodash';
import { useTranslations } from 'next-intl';

import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/shared/types/permission.types';

export interface ChildItem {
  id?: number | string;
  name?: string;
  icon?: any;
  children?: ChildItem[];
  item?: any;
  url?: any;
  color?: string;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: any;
  id?: number;
  to?: string;
  items?: MenuItem[];
  children?: ChildItem[];
  url?: any;
}

/**
 * Handles sidebar content in the dashboard sidebar workflow.
 * @returns Processed collection for downstream workflow steps.
 */
export const SidebarContent = (): MenuItem[] => {
  const t = useTranslations('menu');
  const { hasPermission } = usePermissions();

  const menuItems = [
    {
      heading: t('home'),
      children: [
        {
          name: t('dashboard'),
          icon: 'solar:widget-add-line-duotone',
          id: uniqueId(),
          url: '/',
        },
      ],
    },
    {
      heading: t('service'),
      children: [
        {
          name: t('newsList'),
          icon: 'solar:document-outline',
          id: uniqueId(),
          url: '/news',
        },
        {
          name: t('marketReport'),
          icon: 'solar:chart-line-duotone',
          id: uniqueId(),
          url: '/market-signals',
        },
        {
          name: t('allocationReport'),
          icon: 'solar:chart-line-duotone',
          id: uniqueId(),
          url: '/allocation-recommendations',
        },
        {
          name: t('tradeList'),
          icon: 'uil:exchange',
          id: uniqueId(),
          url: '/trades',
        },
      ],
    },
    {
      heading: t('config'),
      children: [
        {
          name: t('register'),
          icon: 'solar:chat-round-money-bold',
          id: uniqueId(),
          url: '/register',
        },
        {
          name: t('notify'),
          icon: 'solar:bell-bold',
          id: uniqueId(),
          url: '/notify',
        },
      ],
    },
  ];

  const adminChildren = [];

  if (hasPermission(['manage:users'])) {
    adminChildren.push(
      {
        name: t('userManagement'),
        icon: 'solar:users-group-rounded-line-duotone',
        id: uniqueId(),
        url: '/users',
      },
      {
        name: t('roleManagement'),
        icon: 'solar:shield-user-line-duotone',
        id: uniqueId(),
        url: '/roles',
      },
    );
  }

  if (hasPermission([Permission.VIEW_PROFIT])) {
    adminChildren.push({
      name: t('profitManagement'),
      icon: 'solar:money-bag-line-duotone',
      id: uniqueId(),
      url: '/profits',
    });
  }

  if (hasPermission([Permission.VIEW_BLACKLISTS])) {
    adminChildren.push({
      name: t('blacklistManagement'),
      icon: 'solar:forbidden-circle-line-duotone',
      id: uniqueId(),
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
      name: t('scheduleManagement'),
      icon: 'solar:calendar-mark-line-duotone',
      id: uniqueId(),
      url: '/schedules',
    });
  }

  if (hasPermission([Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT])) {
    adminChildren.push({
      name: t('allocationAudit'),
      icon: 'solar:checklist-minimalistic-line-duotone',
      id: uniqueId(),
      url: '/allocation-audits',
    });
  }

  if (adminChildren.length > 0) {
    menuItems.push({
      heading: t('admin'),
      children: adminChildren,
    });
  }

  return menuItems;
};
