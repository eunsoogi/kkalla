import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';

import UpgradePlan from '/public/images/backgrounds/upgrade.png';

const Upgrade = () => {
  return (
    <>
      <div className='px-4 mt-8 relative'>
        <div className='bg-lightprimary py-4 px-5 rounded-xl '>
          <div className='grid grid-cols-12'>
            <div className='col-span-7'>
              <h6 className='text-base text-dark'>Upgrade to pro</h6>
              <Button color={'primary'} className='mt-3 rounded-xl' as={Link} href='#'>
                Buy Pro
              </Button>
            </div>
            <Image src={UpgradePlan} alt='upgrade' className='absolute h-24 w-24 end-0' />
          </div>
        </div>
      </div>
    </>
  );
};

export default Upgrade;
