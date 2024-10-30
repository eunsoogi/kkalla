import { uniqueId } from 'lodash';

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

const SidebarContent: MenuItem[] = [
  {
    heading: '홈',
    children: [
      {
        name: '대시보드',
        icon: 'solar:widget-add-line-duotone',
        id: uniqueId(),
        url: '/',
      },
    ],
  },
];

export default SidebarContent;
