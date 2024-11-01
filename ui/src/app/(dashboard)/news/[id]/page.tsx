import React from 'react';

import NewsListDetail from '@/components/news/NewsListDetail';

const Page: React.FC<{ params: { id?: string } }> = async ({ params }) => {
  const { id } = await params;
  return <NewsListDetail id={id} />;
};

export default Page;
