import CallList from '@/components/ui/CallList'
import React from 'react'

const Upcoming = () => {
  return (
    <section className='flex size-full flex-col gap-8 text-white'>
      <div className='flex flex-col gap-2'>
        <p className='text-xs uppercase tracking-[0.3em] text-mist-2'>Schedule</p>
        <h1 className='font-display text-3xl font-semibold'>Upcoming</h1>
      </div>
      <CallList type="upcoming" />
    </section>
  )
}

export default Upcoming
