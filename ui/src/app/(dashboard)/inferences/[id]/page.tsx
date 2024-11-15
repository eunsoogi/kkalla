import React from 'react';

import { InferenceDetail } from '@/components/inference/InferenceDetail';

const Page: React.FC<{ params: Promise<{ id?: string }> }> = async ({ params }) => {
  const { id } = await params;
  return <InferenceDetail id={id} />;
};

export default Page;
