import { Metadata } from 'next';
import React from 'react';

import { NotFoundError } from '@/app/_shared/errors/NotFoundError';

export const metadata: Metadata = {
  title: 'Error-404',
};

/**
 * Renders the Not Found UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export default function NotFound() {
  return <NotFoundError />;
}
