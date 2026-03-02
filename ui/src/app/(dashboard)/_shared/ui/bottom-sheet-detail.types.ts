import type { ReactNode } from 'react';

export interface BottomSheetDetailProps {
  show: boolean;
  onClose: () => void;
  title: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
}
