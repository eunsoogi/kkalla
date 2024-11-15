import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { Button } from 'flowbite-react';

import ErrorImg from '/public/images/backgrounds/errorimg.svg';

export const metadata: Metadata = {
  title: 'Error-404',
};
const Error = () => {
  return (
    <>
      <div className='h-screen flex items-center justify-center bg-white dark:bg-dark'>
        <div className='text-center'>
          <Image src={ErrorImg} alt='error' className='mb-4' />
          <h1 className='text-ld text-4xl mb-6'>Opps!!!</h1>
          <h6 className='text-xl text-ld'>This page you are looking for could not be found.</h6>
          <Button color={'primary'} as={Link} href='/' className='w-fit mt-6 mx-auto'>
            Go Back to Home
          </Button>
        </div>
      </div>
    </>
  );
};

export default Error;
