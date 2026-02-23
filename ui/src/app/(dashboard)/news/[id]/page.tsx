import React from 'react';

import NewsListDetail from '@/app/(dashboard)/news/_components/NewsListDetail';

const Page: React.FC<{ params: Promise<{ id?: string }> }> = async ({ params }) => {
  const { id } = await params;
  return <NewsListDetail id={id} />;
};

export default Page;
