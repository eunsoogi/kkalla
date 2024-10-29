'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { getInferencesAction } from './action';
import { initialState } from './type';

export const useInferencesSuspenseQuery = () => {
  return useSuspenseQuery({
    queryKey: ['inferences'],
    queryFn: getInferencesAction,
    initialData: initialState,
    staleTime: 0,
  });
};
