import React from 'react';

import NewsListDetail from '@/app/(dashboard)/news/_components/NewsListDetail';

/**
 * Renders the Page UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const Page: React.FC<{ params: Promise<{ id?: string }> }> = async ({ params }) => {
  const { id } = await params;
  return <NewsListDetail id={id} />;
};

export default Page;
