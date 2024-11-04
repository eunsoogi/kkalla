import React from 'react';

import InferenceListDetail from '@/components/inference/InferenceListDetail';

const Page: React.FC<{ params: Promise<{ id?: string }> }> = async ({ params }) => {
  const { id } = await params;
  return <InferenceListDetail id={id} />;
};

export default Page;
