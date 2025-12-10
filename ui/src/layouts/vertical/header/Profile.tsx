import Image from 'next/image';
import React from 'react';

import { Button, Dropdown } from 'flowbite-react';
import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import DefaultUserImage from '@/../public/images/profile/user-1.jpg';

const Profile = () => {
  const t = useTranslations();
  const { data: sessionData } = useSession();
  const userImage = sessionData?.user?.image;

  return (
    <div className='relative group/menu'>
      <Dropdown
        label=''
        className='rounded-sm w-44'
        dismissOnClick={false}
        renderTrigger={() => (
          <span className='flex h-10 w-10 cursor-pointer items-center justify-center rounded-full hover:bg-lightprimary hover:text-primary group-hover/menu:bg-lightprimary group-hover/menu:text-primary'>
            <Image
              src={userImage ? userImage : DefaultUserImage}
              alt={t('profile')}
              height={35}
              width={35}
              className='rounded-full'
              priority
              {...(userImage && { unoptimized: true })}
            />
          </span>
        )}
      >
        {/* <Dropdown.Item
          as={Link}
          href='/register'
          className='flex w-full items-center gap-3 bg-hover px-3 py-3 text-dark group/link'
        >
          <Icon icon='solar:chat-round-money-bold' height={20} />
          {t('service.title')}
        </Dropdown.Item> */}
        <div className='flex flex-col p-3'>
          <Button
            onClick={() => signOut()}
            size='sm'
            className='mt-2 border border-primary bg-transparent text-primary hover:bg-lightprimary focus:outline-none'
          >
            {t('auth.signout')}
          </Button>
        </div>
      </Dropdown>
    </div>
  );
};

export default Profile;
