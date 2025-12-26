import CallList from '@/components/ui/CallList'
import React from 'react'

const Previous = () => {
  return (
    <section className='flex size-full flex-col gap-8 text-white'>
      <div className='flex flex-col gap-2'>
        <p className='text-xs uppercase tracking-[0.3em] text-mist-2'>Archive</p>
        <h1 className='font-display text-3xl font-semibold'>Previous</h1>
      </div>
      <CallList type='ended' />
    </section>
  )
}

export default Previous
