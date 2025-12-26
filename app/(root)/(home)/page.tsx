import MeetingTypeList from '@/components/ui/MeetingTypeList';
import React from 'react'

const Home = () => {
  const nowDate = new Date();

  const time = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const date = (new Intl.DateTimeFormat('en-US', { dateStyle: 'full' })).format(nowDate)
  return (
    <section className='flex size-full flex-col gap-10 text-white'>
      <div className='orbit-rise relative w-full overflow-hidden rounded-[28px] border border-white/10 bg-orbit-2/80 p-8 shadow-orbit'>
        <div className='absolute -right-24 -top-24 h-56 w-56 rounded-full bg-comet-1/20 blur-3xl' />
        <div className='absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-aurora-1/20 blur-3xl' />
        <div className='absolute inset-0 opacity-40'>
          <div className='orbit-grid h-full w-full' />
        </div>
        <div className='relative flex flex-col gap-8'>
          <div className='flex flex-wrap items-start justify-between gap-6'>
            <div className='flex max-w-xl flex-col gap-3'>
              <p className='text-xs uppercase tracking-[0.3em] text-mist-2'>Orbit Conference</p>
              <h1 className='font-display text-4xl font-semibold text-white sm:text-5xl lg:text-6xl'>Control Center</h1>
              <p className='text-sm text-mist-2 sm:text-base'>Launch crisp rooms, share updates, and keep every session in orbit.</p>
            </div>
            <div className='glassmorphism2 orbit-rise orbit-rise-delay-1 flex flex-col items-end gap-2 rounded-2xl px-5 py-4 text-right'>
              <p className='text-xs uppercase tracking-[0.3em] text-mist-2'>Local time</p>
              <h2 className='font-display text-3xl font-semibold text-white'>{time}</h2>
              <p className='text-sm text-mist-2'>{date}</p>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.24em] text-mist-2'>
              <span className='size-2 rounded-full bg-aurora-1' />
              Next room
            </div>
            <p className='text-sm text-mist-2'>Upcoming meeting at 12:30 PM</p>
          </div>
        </div>
      </div>
      <MeetingTypeList/>
    </section>
  )
}

export default Home
