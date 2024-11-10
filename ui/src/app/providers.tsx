'use client';

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
  locale?: string;
  timeZone?: string;
  messages?: AbstractIntlMessages;
}

export function Providers({ children, locale, timeZone, messages }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={messages}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
