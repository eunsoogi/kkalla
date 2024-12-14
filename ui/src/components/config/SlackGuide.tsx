'use client';

import React, { useCallback } from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

const SlackGuide: React.FC = () => {
  const t = useTranslations();

  const handleLinkClick = useCallback(() => {
    window.open('https://api.slack.com/apps', '_blank');
  }, []);

  return (
    <>
      <div className='flex flex-column items-center gap-2'>
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
