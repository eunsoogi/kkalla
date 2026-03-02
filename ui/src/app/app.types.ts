import type { AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';

export interface ProvidersProps {
  children: ReactNode;
  locale?: string;
  timeZone?: string;
  messages?: AbstractIntlMessages;
  requestNow?: string;
}
