import React from 'react';

import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { DecisionTypes } from '@/enums/decision.enum';
import { Inference } from '@/interfaces/inference.interface';

import { getDecisionBadgeStyle, getDecisionDotStyle } from './style';

interface DecisionVerticalProgressBarProps {
  decisions: Inference['decisions'];
}

export const DecisionVerticalProgressBar: React.FC<DecisionVerticalProgressBarProps> = ({ decisions }) => {
  const t = useTranslations();
  const sortedDecisions = [...decisions].sort((a, b) => a.weightLowerBound - b.weightLowerBound);

  return (
    <ul>
      {sortedDecisions.map((item) => (
        <li key={item.id} className='rounded-xl'>
          <div className='flex gap-4 min-h-16'>
            <div className='min-w-24 text-right flex flex-col justify-end'>
              {Math.floor(item.weightLowerBound * 100)}%~{Math.floor(item.weightUpperBound * 100)}%
            </div>
            <div className='flex flex-col items-center'>
              <div className='h-full w-px bg-border dark:bg-gray-800'></div>
              <div className={`rounded-full ${getDecisionDotStyle(item.decision)} p-1.5 mb-1.5 w-fit`}></div>
            </div>
            <div className='flex flex-col justify-end'>
              <div className='text-dark dark:text-white flex items-center gap-2'>
                <p>
                  <Badge className={getDecisionBadgeStyle(item.decision)}>{item.decision}</Badge>
                </p>
                {(item.decision === DecisionTypes.BUY || item.decision === DecisionTypes.SELL) && (
                  <p>
                    {Math.floor(item.orderRatio * 100)}% {t(`decision.${item.decision}`)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};
