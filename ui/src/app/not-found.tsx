import { Metadata } from 'next';
import React from 'react';

import { NotFoundError } from '@/components/error/404';

export const metadata: Metadata = {
  title: 'Error-404',
};

export default function NotFound() {
  return <NotFoundError />;
}
