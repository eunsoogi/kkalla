'use client';
import React from 'react';

import { Icon } from '@iconify/react';

export const LoadingIndicator = React.forwardRef<
  HTMLDivElement,
  {
    isLoading?: boolean;
    loadingText?: string;
  }
>(({ isLoading, loadingText }, ref) => {
  return (
    <div ref={ref} className='h-10'>
      {isLoading && (
        <div className='text-center'>
          <Icon
            icon='eos-icons:loading'
            className='text-ld mx-auto leading-6 dark:text-opacity-60 hide-icon'
            height={36}
          />
          <p>{loadingText}</p>
        </div>
      )}
    </div>
  );
});

LoadingIndicator.displayName = 'LoadingIndicator';
