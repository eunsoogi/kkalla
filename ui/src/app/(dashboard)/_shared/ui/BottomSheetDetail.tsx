'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import type { BottomSheetDetailProps } from './bottom-sheet-detail.types';

const getFocusableElements = (root: HTMLElement): HTMLElement[] => {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
  });
};

/**
 * Renders mobile bottom-sheet detail panel.
 * @param params - Bottom sheet props.
 * @returns Rendered React element.
 */
export const BottomSheetDetail: React.FC<BottomSheetDetailProps> = ({
  show,
  onClose,
  title,
  ariaLabel,
  children,
}) => {
  const t = useTranslations();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const focusables = panelRef.current ? getFocusableElements(panelRef.current) : [];
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }

      const currentFocusables = getFocusableElements(panelRef.current);
      if (currentFocusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement?.focus();
    };
  }, [onClose, show]);

  if (!show) {
    return null;
  }

  return createPortal(
    <div className='fixed inset-0 z-[10000] flex items-end lg:hidden'>
      <button
        type='button'
        aria-label={t('close')}
        className='absolute inset-0 bg-[var(--color-report-sheet-overlay)]'
        onClick={onClose}
      />
      <section
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : t('report.empty.selectItem'))}
        className='relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-[var(--color-report-sheet-border)] bg-[var(--color-report-sheet-bg)] shadow-xl'
      >
        <header className='flex items-center justify-between border-b border-[var(--color-report-sheet-border)] px-4 py-3'>
          <h3 className='text-sm font-semibold text-dark dark:text-white'>{title}</h3>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-[var(--color-report-tab-hover-bg)] hover:text-[var(--color-report-tab-hover-fg)] dark:text-gray-300'
          >
            {t('close')}
          </button>
        </header>
        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>{children}</div>
      </section>
    </div>,
    document.body,
  );
};
