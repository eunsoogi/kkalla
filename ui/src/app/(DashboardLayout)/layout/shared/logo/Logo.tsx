'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import LogoIcon from '/public/images/logos/logo-icon.svg'

const Logo = () => {
  return (
    <Link href={'/'}>
      <Image src={LogoIcon} alt='logo' />
    </Link>
  )
}

export default Logo
