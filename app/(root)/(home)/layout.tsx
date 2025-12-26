import Navbar from '@/components/ui/Navbar'
import SideBar from '@/components/ui/SideBar'
import { Metadata } from 'next';
import React, { ReactNode } from 'react'

export const metadata: Metadata = {
    title: "Orbit Conference",
    description: "Orbit Conference video collaboration hub.",
    icons: {
        icon: '/images/watermark.svg'
    }
};

const HomeLayout = ({ children }: { children: ReactNode }) => {
    return (
        <main className='relative'>
            <Navbar />
            <div className='flex'>
                <SideBar />
                <section className='relative flex min-h-screen flex-1 flex-col px-6 pb-10 pt-28 max-md:pb-16 sm:px-12'>
                    <div className='pointer-events-none absolute inset-0 -z-10 opacity-40'>
                        <div className='orbit-grid h-full w-full' />
                    </div>
                    <div className='w-full'>
                        {children}
                    </div>
                </section>
            </div>
        </main>
    )
}

export default HomeLayout
