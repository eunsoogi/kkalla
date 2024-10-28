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
  {
    heading: '인증',
    children: [
      {
        name: '로그인',
        icon: 'solar:login-2-linear',
        id: uniqueId(),
        url: '/login',
      },
      {
        name: '회원가입',
        icon: 'solar:shield-user-outline',
        id: uniqueId(),
        url: '/register',
      },
    ],
  },
  {
    heading: '설정',
    children: [
      {
        name: 'API 키',
        icon: 'solar:key-outline',
        id: uniqueId(),
        url: '/config/apikey',
      },
    ],
  },
];

export default SidebarContent;
