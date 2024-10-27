import Link from 'next/link'
import React from 'react'

import BlogCards from '../components/dashboard/BlogCards'
import DailyActivity from '../components/dashboard/DailyActivity'
import NewCustomers from '../components/dashboard/NewCustomers'
import ProductRevenue from '../components/dashboard/ProductRevenue'
import SalesProfit from '../components/dashboard/RevenueForecast'
import TotalIncome from '../components/dashboard/TotalIncome'

const page = () => {
  return (
    <>
      <div className='grid grid-cols-12 gap-30'>
        <div className='lg:col-span-8 col-span-12'>
          <SalesProfit />
        </div>
        <div className='lg:col-span-4 col-span-12'>
          <div className='grid grid-cols-12 h-full items-stretch'>
            <div className='col-span-12 mb-30'>
              <NewCustomers />
            </div>
            <div className='col-span-12'>
              <TotalIncome />
            </div>
          </div>
        </div>
        <div className='lg:col-span-8 col-span-12'>
          <ProductRevenue />
        </div>
        <div className='lg:col-span-4 col-span-12'>
          <DailyActivity />
        </div>
        <div className='col-span-12'>
          <BlogCards />
        </div>
      </div>
    </>
  )
}

export default page
