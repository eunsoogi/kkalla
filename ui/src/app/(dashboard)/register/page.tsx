import React from 'react';
import { getTranslations } from 'next-intl/server';

import CategoryForm from '@/components/category/CategoryForm';
import ScheduleForm from '@/components/config/ScheduleForm';
import UpbitForm from '@/components/config/UpbitForm';
import UpbitGuide from '@/components/config/UpbitGuide';
import RegisterProgressPanel from '@/components/register/RegisterProgressPanel';

const Page = async () => {
  const t = await getTranslations();

  return (
    <div className='space-y-6'>
      <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 md:p-8'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-dark dark:text-white'>{t('service.registerFlow.headline')}</h1>
            <p className='mt-2 text-gray-500 dark:text-gray-400'>{t('service.registerFlow.description')}</p>
          </div>
          <div className='rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 lg:max-w-xs'>
            <p className='text-sm font-semibold text-dark dark:text-white'>{t('service.registerFlow.stepHintTitle')}</p>
            <ul className='mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300'>
              <li>{t('service.registerFlow.stepHintUpbit')}</li>
              <li>{t('service.registerFlow.stepHintCategory')}</li>
              <li>{t('service.registerFlow.stepHintActivate')}</li>
            </ul>
          </div>
        </div>
      </section>

      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12 xl:col-span-8 space-y-6'>
          <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
            <div className='pb-6 border-b border-gray-100 dark:border-gray-800'>
              <span className='inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-lightprimary text-primary dark:bg-primary dark:text-white'>
                {t('service.registerFlow.step1Label')}
              </span>
              <h2 className='mt-3 text-lg font-semibold text-dark dark:text-white'>{t('service.registerFlow.step1Title')}</h2>
              <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('service.registerFlow.step1Description')}</p>
            </div>
            <div className='pt-6'>
              <UpbitGuide />
            </div>
            <div className='pt-6 mt-6 border-t border-gray-100 dark:border-gray-800'>
              <UpbitForm />
            </div>
          </section>

          <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
            <div className='pb-6 border-b border-gray-100 dark:border-gray-800'>
              <span className='inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-lightprimary text-primary dark:bg-primary dark:text-white'>
                {t('service.registerFlow.step2Label')}
              </span>
              <h2 className='mt-3 text-lg font-semibold text-dark dark:text-white'>{t('service.registerFlow.step2Title')}</h2>
              <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('service.registerFlow.step2Description')}</p>
            </div>
            <div className='pt-6'>
              <ScheduleForm />
            </div>
          </section>

          <section className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
            <div className='pb-6 border-b border-gray-100 dark:border-gray-800'>
              <span className='inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-lightprimary text-primary dark:bg-primary dark:text-white'>
                {t('service.registerFlow.step3Label')}
              </span>
              <h2 className='mt-3 text-lg font-semibold text-dark dark:text-white'>{t('service.registerFlow.step3Title')}</h2>
              <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('service.registerFlow.step3Description')}</p>
            </div>
            <div className='pt-6'>
              <CategoryForm />
            </div>
          </section>
        </div>

        <div className='col-span-12 xl:col-span-4'>
          <div className='xl:sticky xl:top-[96px]'>
            <RegisterProgressPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
