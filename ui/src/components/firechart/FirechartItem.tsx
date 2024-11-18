'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { useTranslations } from 'next-intl';

interface FirechartItemProps {
  src: string | null;
}

export const FirechartItem: React.FC<FirechartItemProps> = ({ src }) => {
  const t = useTranslations();

  if (!src) {
    return <div>{t('nothing')}</div>;
  }

  return (
    <Link href={src} target='_blank'>
      <Image src={src} alt={t('firechart.title')} width={100} height={100} className='rounded-xl w-full' unoptimized />
    </Link>
  );
};

export const FirechartSkeleton: React.FC = () => {
  const t = useTranslations();

  return <div>{t('loading')}</div>;
};
