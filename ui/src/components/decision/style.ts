import { DecisionTypes } from '@/enums/decision.enum';

export const getDecisionDotStyle = (decision?: string): string | undefined => {
  if (!decision) return undefined;

  switch (decision.toLowerCase()) {
    case DecisionTypes.BUY:
      return 'bg-success';
    case DecisionTypes.HOLD:
      return 'bg-warning';
    case DecisionTypes.SELL:
      return 'bg-error';
  }

  return undefined;
};

export const getDecisionBadgeStyle = (decision?: string): string | undefined => {
  if (!decision) return undefined;

  switch (decision.toLowerCase()) {
    case DecisionTypes.BUY:
      return 'text-success bg-lightsuccess dark:text-white dark:bg-success';
    case DecisionTypes.HOLD:
      return 'text-warning bg-lightwarning dark:text-white dark:bg-warning';
    case DecisionTypes.SELL:
      return 'text-error bg-lighterror dark:text-white dark:bg-error';
  }

  return 'text-gray-800 bg-gray-200';
};
