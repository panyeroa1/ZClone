'use client'
import {
    Sheet, SheetClose, SheetContent, SheetTrigger,
} from "@/components/ui/sheet"
import { sidebarLinks } from "@/constants"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from 'react'

const MobileNav = () => {
    const pathName = usePathname();
    return (
        <section className='w-full max-w-[264px] '>
            <Sheet>
                <SheetTrigger><Image src={"/icons/hamburger.svg"} alt={"sidebar burger icon"} width={36} height={36} className="cursor-pointer sm:hidden" /></SheetTrigger>
                <SheetContent side='left' className="border-none bg-orbit-1/95">

                    <Link href={'/'} className='flex items-center gap-3'>
                        <Image src={'/images/watermark.svg'} alt={'Orbit Conference'} width={140} height={42} priority className='h-8 w-auto opacity-95' />
                        <span className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-mist-2'>
                            Conference
                        </span>
                    </Link>

                    <div className="flex h-[calc(100vh - 72px)] flex-col justify-between overflow-y-auto">

                        <SheetClose asChild>
                            <section className="flex h-full flex-col gap-6 pt-16 text-white">
                                {
                                    sidebarLinks.map((link) => {
                                        const isActive = link.route === pathName;
                                        return (
                                            <SheetClose asChild key={link.route}>
                                                <Link href={link.route} key={link.label} className={cn('flex w-full max-w-60 items-center gap-4 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/5', { 'bg-white/10 border-white/20': isActive })}>
                                                    <Image src={link.imgUrl} alt={link.label + "Image"} width={20} height={20} />
                                                    <p>{link.label}</p>
                                                </Link>
                                            </SheetClose>
                                        );
                                    })
                                }
                            </section>
                        </SheetClose>

                    </div>
                </SheetContent>
            </Sheet>

        </section>
    )
}

export default MobileNav
