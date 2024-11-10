import { uniqueId } from 'lodash';
import { useTranslations } from 'next-intl';

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

  return [
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
      ],
    },
  ];
};
