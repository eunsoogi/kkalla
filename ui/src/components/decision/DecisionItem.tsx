import React from 'react';

import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Decision } from '@/interfaces/decision.interface';

import { CopyLinkButton } from '../common/CopyLinkButton';
import { DECISION_STYLES } from './style';

interface DecisionItemProps {
  item: Decision;
}

export const DecisionItem: React.FC<DecisionItemProps> = ({ item }) => {
  const t = useTranslations();

  return (
    <div className='flex flex-col w-full my-3'>
      <div className='flex flex-row gap-6'>
        <Badge className={DECISION_STYLES[item.decision].badgeStyle}>{item.decision}</Badge>
        <div className='flex flex-col'>
          <h4 className='text-dark dark:text-white'>
            {item.orderRatio * 100}% {t(`decision.${item.decision}`)}
          </h4>
          <p>
            {t('inference.bound', {
              lower: Math.floor(item.weightLowerBound * 100),
              upper: Math.floor(item.weightUpperBound * 100),
            })}
          </p>
        </div>
        <div className='ml-auto'>
          <CopyLinkButton path={`/decisions/${item.id}`} />
        </div>
      </div>
      <div className='flex flex-col mt-3'>
        <h4 className='text-dark dark:text-white'>{t('inference.reason')}</h4>
        <div className='whitespace-pre-wrap'>{item.reason}</div>
      </div>
    </div>
  );
};
