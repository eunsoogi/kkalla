import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import React from 'react';
import { cookies } from 'next/headers';
import { ThemeModeScript, ThemeProvider } from 'flowbite-react/theme';
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
  const requestNow = new Date().toISOString();

  // 서버 사이드에서 쿠키를 읽어 초기 theme mode를 결정한다.
  const cookieStore = await cookies();
  const themeModeCookie = cookieStore.get('flowbite-theme-mode')?.value;
  const resolvedThemeCookie = cookieStore.get('flowbite-theme')?.value ||
    cookieStore.get('color-theme')?.value ||
    cookieStore.get('theme')?.value;
  const defaultThemeMode =
    themeModeCookie === 'light' || themeModeCookie === 'dark' || themeModeCookie === 'auto'
      ? themeModeCookie
      : 'auto';
  const initialTheme = resolvedThemeCookie === 'dark' ? 'dark' : '';

  return (
    <html lang={locale} className={initialTheme} suppressHydrationWarning>
      <head>
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
        <ThemeModeScript defaultMode={defaultThemeMode} />
      </head>
      <body className={`${manrope.className}`}>
        <ThemeProvider theme={customTheme as any} root>
          <Providers locale={locale} timeZone={timeZone} messages={messages} requestNow={requestNow}>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
