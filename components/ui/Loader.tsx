import Image from 'next/image'
import React from 'react'

const Loader = () => {
    return (
        <div className='flex-center h-screen w-full flex-col gap-3 text-mist-2'>
            <Image src="/icons/loading-circle.svg" alt='Loading Icon' width={50} height={50} className='animate-spin' />
            <p className='text-xs uppercase tracking-[0.3em]'>Preparing orbit</p>
        </div>
    )
}

export default Loader
