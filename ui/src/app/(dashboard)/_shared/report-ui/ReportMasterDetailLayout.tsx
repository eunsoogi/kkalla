'use client';
import React, { useSyncExternalStore } from 'react';

import { BottomSheetDetail } from '@/app/(dashboard)/_shared/ui/BottomSheetDetail';

import type { ReportMasterDetailLayoutProps } from './report-master-detail.types';

const MOBILE_MEDIA_QUERY = '(max-width: 768px)';

const subscribeMobileQuery = (onStoreChange: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  const handleChange = () => onStoreChange();

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
};

const getMobileSnapshot = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
};

/**
 * Renders responsive master-detail layout for reports.
 * @param params - Layout props.
 * @returns Rendered React element.
 */
export const ReportMasterDetailLayout: React.FC<ReportMasterDetailLayoutProps> = ({
  listPane,
  detailPane,
  mobileDetailOpen,
  mobileDetailTitle,
  mobileDetailAriaLabel,
  onMobileDetailClose,
}) => {
  const isMobile = useSyncExternalStore(subscribeMobileQuery, getMobileSnapshot, () => false);

  if (isMobile) {
    return (
      <>
        {listPane}
        <BottomSheetDetail
          show={mobileDetailOpen}
          onClose={onMobileDetailClose}
          title={mobileDetailTitle}
          ariaLabel={mobileDetailAriaLabel}
        >
          {detailPane}
        </BottomSheetDetail>
      </>
    );
  }

  return (
    <div className='grid w-full min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-12'>
      <div className='min-w-0 md:col-span-5'>{listPane}</div>
      <div className='min-w-0 md:col-span-7 md:sticky md:top-[96px] md:self-start'>{detailPane}</div>
    </div>
  );
};
