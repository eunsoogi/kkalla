import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import React from 'react';
import { cookies } from 'next/headers';
import { ThemeModeScript, ThemeProvider } from 'flowbite-react';
import { getLocale, getMessages, getTimeZone } from 'next-intl/server';
import 'simplebar-react/dist/simplebar.min.css';

import customTheme from '@/utils/theme/custom-theme';

import './css/globals.css';
import { Providers } from './providers';

const manrope = Manrope({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '칼라 - AI 투자 비서',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const timeZone = await getTimeZone();
  const messages = await getMessages();

  // 서버 사이드에서 쿠키를 읽어서 초기 dark mode 상태 결정
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('flowbite-theme')?.value ||
                       cookieStore.get('color-theme')?.value ||
                       cookieStore.get('theme')?.value;
  const initialTheme = themeCookie === 'dark' ? 'dark' : '';

  return (
    <html lang={locale} className={initialTheme}>
      <head>
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // 서버에서 설정한 테마를 localStorage에 동기화
                  const serverTheme = '${initialTheme || 'light'}';
                  const currentTheme = localStorage.getItem('flowbite-theme') ||
                                       localStorage.getItem('color-theme') ||
                                       localStorage.getItem('theme');

                  // localStorage에 값이 없거나 서버 값과 다르면 서버 값으로 설정
                  if (!currentTheme || currentTheme !== serverTheme) {
                    localStorage.setItem('flowbite-theme', serverTheme);
                  }

                  // HTML 클래스 설정 (ThemeModeScript가 실행되기 전에)
                  if (serverTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeModeScript />
      </head>
      <body className={`${manrope.className}`}>
        <ThemeProvider theme={customTheme as any} root>
          <Providers locale={locale} timeZone={timeZone} messages={messages}>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
