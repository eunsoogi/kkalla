import Link from 'next/link';
import React from 'react';

import { Icon } from '@iconify/react';
import { Button, Dropdown } from 'flowbite-react';
import { signOut, useSession } from 'next-auth/react';

const Profile = () => {
  const session = useSession();

  return (
    <div className='relative group/menu'>
      <Dropdown
        label=''
        className='rounded-sm w-44'
        dismissOnClick={false}
        renderTrigger={() => (
          <span className='h-10 w-10 hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary'>
            <img
              src={session.data?.user?.image || undefined}
              alt='logo'
              height='35'
              width='35'
              className='rounded-full'
            />
          </span>
        )}
      >
        <Dropdown.Item
          as={Link}
          href='/apikeys'
          className='px-3 py-3 flex items-center bg-hover group/link w-full gap-3 text-dark'
        >
          <Icon icon='solar:key-outline' height={20} />
          API 키
        </Dropdown.Item>
        <div className='p-3 flex flex-col'>
          <Button
            onClick={() => signOut()}
            size={'sm'}
            className='mt-2 border border-primary text-primary bg-transparent hover:bg-lightprimary outline-none focus:outline-none'
          >
            로그아웃
          </Button>
        </div>
      </Dropdown>
    </div>
  );
};

export default Profile;
