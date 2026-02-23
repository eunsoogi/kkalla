import React from 'react';
import { getTranslations } from 'next-intl/server';

import SlackForm from '@/app/(dashboard)/notify/_components/SlackForm';
import SlackGuide from '@/app/(dashboard)/notify/_components/SlackGuide';
import SlackProgressPanel from '@/app/(dashboard)/notify/_components/SlackProgressPanel';

/**
 * Renders the Page UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const Page = async () => {
  const t = await getTranslations();

  return (
    <div className='space-y-6'>
      <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 md:p-8'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-dark dark:text-white'>{t('notify.registerFlow.headline')}</h1>
            <p className='mt-2 text-gray-500 dark:text-gray-400'>{t('notify.registerFlow.description')}</p>
          </div>
          <div className='rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 lg:max-w-xs'>
            <p className='text-sm font-semibold text-dark dark:text-white'>{t('notify.registerFlow.stepHintTitle')}</p>
            <ul className='mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300'>
              <li>{t('notify.registerFlow.stepHintGuide')}</li>
              <li>{t('notify.registerFlow.stepHintForm')}</li>
            </ul>
          </div>
        </div>
      </section>

      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12 xl:col-span-8 space-y-6'>
          <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
            <div className='pb-6 border-b border-gray-100 dark:border-gray-800'>
              <span className='inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-lightprimary text-primary dark:bg-primary dark:text-white'>
                {t('notify.registerFlow.step1Label')}
              </span>
              <h2 className='mt-3 text-lg font-semibold text-dark dark:text-white'>{t('notify.registerFlow.step1Title')}</h2>
              <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('notify.registerFlow.step1Description')}</p>
            </div>
            <div className='pt-6'>
              <SlackGuide />
            </div>
          </section>
          <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
            <div className='pb-6 border-b border-gray-100 dark:border-gray-800'>
              <span className='inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-lightprimary text-primary dark:bg-primary dark:text-white'>
                {t('notify.registerFlow.step2Label')}
              </span>
              <h2 className='mt-3 text-lg font-semibold text-dark dark:text-white'>{t('notify.registerFlow.step2Title')}</h2>
              <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('notify.registerFlow.step2Description')}</p>
            </div>
            <div className='pt-6'>
              <SlackForm />
            </div>
          </section>
        </div>

        <div className='col-span-12 xl:col-span-4'>
          <div className='xl:sticky xl:top-[96px]'>
            <SlackProgressPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
