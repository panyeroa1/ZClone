import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import MobileNav from './MobileNav'
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

const Navbar = () => {
  return (
    <nav className='flex-between fixed z-50 w-full border-b border-white/10 bg-orbit-1/80 px-6 py-4 backdrop-blur-lg lg:px-10'>

      <Link href={'/'} className='flex items-center gap-4'>
        <Image src={'/images/watermark.svg'} alt={'Orbit Conference'} width={140} height={42} priority className='h-8 w-auto opacity-95' />
        <span className='hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-mist-2 sm:inline'>
          Conference
        </span>
      </Link>
      <div className='flex-between gap-5'>
        <SignedIn>
          <UserButton afterSignOutUrl="/sign-in" />
        </SignedIn>
        <MobileNav />
      </div>
    </nav>
  )
}

export default Navbar
