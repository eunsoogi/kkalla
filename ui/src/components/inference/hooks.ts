'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { getInferencesAction } from './actions';
import { initialState } from './state';

export const useInferencesSuspenseQuery = () => {
  return useSuspenseQuery({
    queryKey: ['inferences'],
    queryFn: getInferencesAction,
    initialData: initialState,
    staleTime: 0,
  });
};
