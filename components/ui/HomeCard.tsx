import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils';

interface HomeCardProps {
    className?: string;
    accentClass?: string;
    img:string;
    title:string;
    description:string;
    handleClick: () => void;
}

const HomeCard = ({ className, accentClass = 'bg-comet-1/25', img, title, description, handleClick }:HomeCardProps) => {
    return (
        <div className={cn('group relative flex min-h-[240px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-orbit-2 via-orbit-2 to-orbit-3 p-5 shadow-orbit transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-orbit-soft', className)} onClick={handleClick}>
            <span className={cn('absolute -right-12 -top-12 h-28 w-28 rounded-full blur-2xl opacity-70 transition duration-300 group-hover:opacity-100', accentClass)} />
            <div className='relative flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20'>
                <Image src={img} alt={'meeting'} width={24} height={24} className='opacity-90' />
            </div>
            <div className="relative flex flex-col gap-2">
                <h1 className='font-display text-xl font-semibold text-white'>{title}</h1>
                <p className='text-sm text-mist-2' >{description}</p>
            </div>
        </div>
    )
}

export default HomeCard
