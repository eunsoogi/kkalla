'use client';
import React, { useCallback } from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

/**
 * Renders the Slack Guide UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const SlackGuide: React.FC = () => {
  const t = useTranslations();

  const handleLinkClick = useCallback(() => {
    window.open('https://api.slack.com/apps', '_blank');
  }, []);

  return (
    <>
      <div className='flex flex-col items-start gap-2 text-left w-full'>
        <h5 className='card-title text-dark dark:text-white'>{t('slack.guide')}</h5>
      </div>
      <div className='mt-6'>{t('slack.description')}</div>
      <div className='flex justify-center mt-4'>
        <Button onClick={handleLinkClick} color={'primary'}>
          {t('slack.link')}
        </Button>
      </div>
    </>
  );
};

export default SlackGuide;
