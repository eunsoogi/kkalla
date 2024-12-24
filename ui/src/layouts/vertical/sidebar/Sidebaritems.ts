import { uniqueId } from 'lodash';
import { useTranslations } from 'next-intl';

import { usePermissions } from '@/hooks/usePermissions';

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
          name: t('inferenceList'),
          icon: 'mingcute:ai-line',
          id: uniqueId(),
          url: '/inferences',
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

  if (hasPermission(['manage:users'])) {
    menuItems.push({
      heading: t('admin'),
      children: [
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
      ],
    });
  }

  return menuItems;
};
