import Link from 'next/link'
import React from 'react'

import { Button, Checkbox, Label, TextInput } from 'flowbite-react'

const AuthLogin = () => {
  return (
    <>
      <form>
        <div className='mb-4'>
          <div className='mb-2 block'>
            <Label htmlFor='Username' value='Username' />
          </div>
          <TextInput id='username' type='text' sizing='md' className='form-control form-rounded-xl' />
        </div>
        <div className='mb-4'>
          <div className='mb-2 block'>
            <Label htmlFor='userpwd' value='Password' />
          </div>
          <TextInput id='userpwd' type='password' sizing='md' className='form-control form-rounded-xl' />
        </div>
        <div className='flex justify-between my-5'>
          <div className='flex items-center gap-2'>
            <Checkbox id='accept' className='checkbox' />
            <Label htmlFor='accept' className='opacity-90 font-normal cursor-pointer'>
              Remeber this Device
            </Label>
          </div>
          <Link href={'/'} className='text-primary text-sm font-medium'>
            Forgot Password ?
          </Link>
        </div>
        <Button color={'primary'} href='/' as={Link} className='w-full bg-primary text-white rounded-xl'>
          Sign in
        </Button>
      </form>
    </>
  )
}

export default AuthLogin
