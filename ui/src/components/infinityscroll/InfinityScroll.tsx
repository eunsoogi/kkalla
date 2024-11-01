'use client';

import React from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { LoadingIndicator } from '../loading/LoadingIndicator';

export const InfinityScroll: React.FC<{
  onIntersect: () => void;
  isLoading?: boolean;
  loadingText?: string;
  children?: React.ReactNode;
}> = ({ onIntersect, isLoading, loadingText, children }) => {
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    ([entry]: IntersectionObserverEntry[]) => {
      if (entry.isIntersecting) {
        onIntersect();
      }
    },
    [onIntersect],
  );

  useEffect(() => {
    const element = loadMoreRef.current;

    if (!element) {
      return;
    }

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  return (
    <>
      {children}
      <LoadingIndicator ref={loadMoreRef} isLoading={isLoading} loadingText={loadingText} />
    </>
  );
};
