import React from 'react';

import { Badge } from 'flowbite-react';

import { stringToColor } from '@/utils/color';

interface ColoredBadgeProps {
  text: string;
  className?: string;
}

export const ColoredBadge = ({ text, className = '' }: ColoredBadgeProps) => {
  const color = stringToColor(text);

  return (
    <Badge
      className={className}
      style={{
        color: color,
        backgroundColor: 'transparent',
        border: `1px solid ${color}`,
      }}
    >
      {text}
    </Badge>
  );
};
