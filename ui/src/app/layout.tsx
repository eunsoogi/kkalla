import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import React from 'react'

import { Flowbite, ThemeModeScript } from 'flowbite-react'
import 'simplebar-react/dist/simplebar.min.css'

import customTheme from '@/utils/theme/custom-theme'

import './css/globals.css'

const manrope = Manrope({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MatDash-Nextjs-Free'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
        <ThemeModeScript />
      </head>
      <body className={`${manrope.className}`}>
        <Flowbite theme={{ theme: customTheme }}>{children}</Flowbite>
      </body>
    </html>
  )
}
