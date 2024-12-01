import React from 'react';

import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { DecisionTypes } from '@/enums/decision.enum';
import { Inference } from '@/interfaces/inference.interface';

import { getDecisionBadgeStyle, getDecisionDotStyle } from './style';

interface DecisionHorizontalProgressBarProps {
  decisions: Inference['decisions'];
}

export const DecisionHorizontalProgressBar: React.FC<DecisionHorizontalProgressBarProps> = ({ decisions }) => {
  const t = useTranslations();
  const sortedDecisions = [...decisions].sort((a, b) => a.weightLowerBound - b.weightLowerBound);

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex relative h-4'>
        {sortedDecisions.map((item) => {
          const midPoint = (item.weightLowerBound + item.weightUpperBound) / 2;
          return (
            <div
              key={item.id}
              className='absolute'
              style={{ left: `${midPoint * 100}%`, transform: 'translateX(-50%)' }}
            >
              {Math.floor(item.weightLowerBound * 100)}~{Math.floor(item.weightUpperBound * 100)}%
            </div>
          );
        })}
      </div>
      <div className='relative h-8'>
        <div className='absolute inset-x-0 h-px bg-border dark:bg-gray-800 top-1/2'></div>
        <div className='absolute inset-0'>
          {sortedDecisions.map((item) => {
            const midPoint = (item.weightLowerBound + item.weightUpperBound) / 2;
            return (
              <div
                key={item.id}
                className='absolute flex items-center justify-center'
                style={{ left: `${midPoint * 100}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className={`rounded-full ${getDecisionDotStyle(item.decision)} p-1.5 border-2 border-white dark:border-dark`}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
      <div className='relative h-12'>
        {sortedDecisions.map((item) => {
          const midPoint = (item.weightLowerBound + item.weightUpperBound) / 2;
          return (
            <div
              key={item.id}
              className='absolute flex flex-col items-center gap-1'
              style={{ left: `${midPoint * 100}%`, transform: 'translateX(-50%)' }}
            >
              <Badge className={getDecisionBadgeStyle(item.decision)}>{item.decision}</Badge>
              {(item.decision === DecisionTypes.BUY || item.decision === DecisionTypes.SELL) && (
                <div>
                  {Math.floor(item.orderRatio * 100)}% {t(`decision.${item.decision}`)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
