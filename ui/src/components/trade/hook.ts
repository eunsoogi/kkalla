'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { getTradesAction } from './action';
import { initialState } from './type';

export const useInferencesSuspenseQuery = () => {
  return useSuspenseQuery({
    queryKey: ['trades'],
    queryFn: getTradesAction,
    initialData: initialState,
    staleTime: 0,
  });
};
