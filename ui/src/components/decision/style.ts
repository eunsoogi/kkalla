export const DECISION_STYLES = {
  buy: {
    dotStyle: 'bg-success',
    badgeStyle: 'text-success bg-lightsuccess dark:text-white dark:bg-success',
  },
  hold: {
    dotStyle: 'bg-warning',
    badgeStyle: 'text-warning bg-lightwarning dark:text-white dark:bg-warning',
  },
  sell: {
    dotStyle: 'bg-error',
    badgeStyle: 'text-error bg-lighterror dark:text-white dark:bg-error',
  },
} as const;
