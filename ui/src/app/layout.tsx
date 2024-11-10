import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import React from 'react';

import { Flowbite, ThemeModeScript } from 'flowbite-react';
import { getLocale, getMessages } from 'next-intl/server';
import 'simplebar-react/dist/simplebar.min.css';

import customTheme from '@/utils/theme/custom-theme';

import './css/globals.css';
import { Providers } from './providers';

const manrope = Manrope({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI 투자 어시스턴트',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
        <ThemeModeScript />
      </head>
      <body className={`${manrope.className}`}>
        <Flowbite theme={{ theme: customTheme }}>
          <Providers locale={locale} messages={messages}>
            {children}
          </Providers>
        </Flowbite>
      </body>
    </html>
  );
}
