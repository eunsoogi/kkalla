import { Metadata } from 'next';
import React from 'react';

import { NotFoundError } from '@/app/_shared/errors/NotFoundError';

export const metadata: Metadata = {
  title: 'Error-404',
};

export default function NotFound() {
  return <NotFoundError />;
}
