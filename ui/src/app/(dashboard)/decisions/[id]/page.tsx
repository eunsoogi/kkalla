import React from 'react';

import { DecisionDetail } from '@/components/decision/DecisionDetail';

const Page: React.FC<{ params: Promise<{ id: string }> }> = async ({ params }) => {
  const { id } = await params;
  return <DecisionDetail id={id} />;
};

export default Page;
