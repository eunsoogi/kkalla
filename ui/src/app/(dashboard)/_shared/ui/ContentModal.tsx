'use client';
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ContentModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: string;
  actionLink?: string;
  renderMarkdown?: boolean;
}

const markdownBodyClassName = [
  'wrap-break-word',
  'break-words',
  'whitespace-pre-wrap',
  '[&_p]:mb-3',
  '[&_p:last-child]:mb-0',
  '[&_ul]:mb-3',
  '[&_ul]:list-disc',
  '[&_ul]:pl-5',
  '[&_ol]:mb-3',
  '[&_ol]:list-decimal',
  '[&_ol]:pl-5',
  '[&_li]:my-1',
  '[&_blockquote]:my-3',
  '[&_blockquote]:border-l-4',
  '[&_blockquote]:border-gray-300',
  '[&_blockquote]:pl-3',
  '[&_blockquote]:text-gray-600',
  '[&_h1]:mb-3',
  '[&_h1]:text-xl',
  '[&_h1]:font-semibold',
  '[&_h2]:mb-3',
  '[&_h2]:text-lg',
  '[&_h2]:font-semibold',
  '[&_h3]:mb-2',
  '[&_h3]:font-semibold',
  '[&_code]:rounded',
  '[&_code]:bg-gray-100',
  '[&_code]:px-1',
  '[&_code]:py-0.5',
  '[&_pre]:mb-3',
  '[&_pre]:overflow-x-auto',
  '[&_pre]:rounded',
  '[&_pre]:bg-gray-100',
  '[&_pre]:p-3',
  '[&_table]:mb-3',
  '[&_table]:w-full',
  '[&_table]:border-collapse',
  '[&_th]:border',
  '[&_th]:border-gray-300',
  '[&_th]:bg-gray-50',
  '[&_th]:px-2',
  '[&_th]:py-1',
  '[&_td]:border',
  '[&_td]:border-gray-300',
  '[&_td]:px-2',
  '[&_td]:py-1',
  'dark:[&_blockquote]:border-gray-600',
  'dark:[&_blockquote]:text-gray-400',
  'dark:[&_code]:bg-gray-800',
  'dark:[&_pre]:bg-gray-800',
  'dark:[&_th]:border-gray-600',
  'dark:[&_th]:bg-gray-800',
  'dark:[&_td]:border-gray-600',
].join(' ');

/**
 * Renders the Content Modal UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export function ContentModal({ show, onClose, title, children, actionLink, renderMarkdown = false }: ContentModalProps) {
  const t = useTranslations();

  useEffect(() => {
    if (!show) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  if (!show) return null;

  const handleOpenArticle = () => {
    if (actionLink) window.open(actionLink, '_blank');
    onClose();
  };

  const modal = (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='content-modal-title'
      className='fixed inset-0 flex items-center justify-center overflow-y-auto overflow-x-hidden p-4'
      style={{ zIndex: 9999 }}
    >
      <div
        className='fixed inset-0 cursor-pointer bg-gray-900/50 dark:bg-gray-900/80'
        aria-hidden='true'
        onClick={onClose}
      />
      <div
        className='relative z-10 flex flex-col rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark overflow-hidden'
        style={{ width: '100%', maxWidth: 'min(32rem, calc(100vw - 2rem))', maxHeight: '90dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='shrink-0 flex items-start justify-between rounded-t-xl border-b border-gray-200 p-4 sm:p-6 dark:border-gray-700'>
          <h2 id='content-modal-title' className='text-lg font-semibold text-dark dark:text-white'>
            {title}
          </h2>
          <button
            type='button'
            onClick={onClose}
            aria-label={t('close')}
            className='ml-auto cursor-pointer inline-flex items-center justify-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white'
          >
            <Icon icon='mdi:close' className='h-5 w-5' aria-hidden />
          </button>
        </div>
        <div className='flex-1 min-h-0 overflow-auto p-4 sm:p-6 text-sm text-gray-700 dark:text-gray-300'>
          {renderMarkdown ? (
            <div className={markdownBodyClassName}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, className, ...props }) => {
                    const { node, ...anchorProps } = props;
                    void node;
                    const isExternal = typeof href === 'string' && /^https?:\/\//.test(href);
                    const linkClassName = `text-primary-600 hover:underline dark:text-primary-400${className ? ` ${className}` : ''}`;
                    return (
                      <a
                        href={href}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noreferrer noopener' : undefined}
                        className={linkClassName}
                        {...anchorProps}
                      />
                    );
                  },
                }}
              >
                {children}
              </ReactMarkdown>
            </div>
          ) : (
            <p className='whitespace-pre-wrap wrap-break-word'>{children}</p>
          )}
        </div>
        {actionLink ? (
          <div className='shrink-0 flex items-center justify-end gap-2 rounded-b-xl border-t border-gray-200 p-4 sm:p-6 dark:border-gray-700'>
            <button
              type='button'
              onClick={handleOpenArticle}
              className='cursor-pointer rounded-xl border-0 bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
            >
              {t('dashboard.openArticle')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
