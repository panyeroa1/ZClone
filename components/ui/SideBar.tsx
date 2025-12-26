'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { sidebarLinks } from '@/constants'
import Image from 'next/image';

const SideBar = () => {
  const pathName = usePathname();

  return (
    <section className='sticky left-0 top-0 flex h-screen w-fit flex-col justify-between border-r border-white/10 bg-orbit-1/90 p-6 pt-28 text-white backdrop-blur max-sm:hidden lg:w-[264px]'>
      <div className='flex flex-col gap-3'>
        {
          sidebarLinks.map((link) => {
              const isActive = link.route === pathName || pathName.startsWith(`${link.route}/`);
              return (
                <Link href={link.route} key={link.label} className={cn('flex items-center justify-start gap-4 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/10 hover:bg-white/5 hover:text-white', { 'border-white/15 bg-white/10 text-white shadow-orbit-soft': isActive })}>
                  <Image src={link.imgUrl} alt={link.label + "Image"} width={24} height={24} />
                  <p className='text-base font-semibold max-lg:hidden'>{link.label}</p>
                </Link>
              );
          })
        }
      </div>
    </section>
  )
}

export default SideBar
