export const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export const getScoreColor = (score: number) => {
  if (score <= 20) return 'var(--color-feargreed-extreme-fear)';
  if (score <= 40) return 'var(--color-feargreed-fear)';
  if (score <= 60) return 'var(--color-feargreed-neutral)';
  if (score <= 80) return 'var(--color-feargreed-greed)';
  return 'var(--color-feargreed-extreme-greed)';
};

export const getDiffColor = (diff: number) => {
  return diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-500' : 'text-gray-500';
};

export const getDiffPrefix = (diff: number) => {
  return diff > 0 ? '+' : '';
};
