export const DECISION_STYLES = {
  buy: {
    dotStyle: 'bg-success',
    badgeStyle: 'text-success bg-lightsuccess',
  },
  hold: {
    dotStyle: 'bg-warning',
    badgeStyle: 'text-warning bg-lightwarning',
  },
  sell: {
    dotStyle: 'bg-error',
    badgeStyle: 'text-error bg-lighterror',
  },
} as const;
