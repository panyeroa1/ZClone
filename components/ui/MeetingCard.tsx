'use client'
import React from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { avatarImages } from '@/constants';
import { useToast } from './use-toast';
import { Button } from './button';

interface MeetingCardProps {
    title: string;
    date: string;
    icon: string;
    isPreviousMeeting?: boolean;
    buttonIcon1?: string;
    buttonText?: string;
    handleClick: () => void;
    link: string;
}


const MeetingCard = ({ icon, title, date, isPreviousMeeting, buttonIcon1, handleClick, link, buttonText }: MeetingCardProps) => {
    const { toast } = useToast();
    return (
        <section className="orbit-card flex min-h-[258px] w-full flex-col justify-between rounded-2xl px-5 py-7 xl:max-w-[568px]">
            <article className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                        <Image src={icon} alt='meeting icon' width={22} height={22} />
                    </span>
                    <div className="flex flex-col gap-1">
                        <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
                        <p className="text-sm text-mist-2">{date}</p>
                    </div>
                </div>
            </article>
            <article className={cn("relative flex items-center justify-between gap-6", {})} >
                <div className="relative flex w-full max-sm:hidden">
                    {avatarImages.map((img, index) => (
                        <Image key={index} src={img} alt={'Attendees Icon'} width={40} height={40} className={cn("rounded-full ring-2 ring-orbit-2", { absolute: index > 0 })} style={{ top: 0, left: index * 28 }} />
                    ))}
                    <div className="flex-center absolute left-[136px] size-10 rounded-full border-[5px] border-orbit-2 bg-orbit-4 text-xs font-semibold text-white">
                        +5
                    </div>
                </div>
                {
                    !isPreviousMeeting && (
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleClick} className='rounded-full bg-comet-1 px-6 text-white shadow-orbit-soft hover:bg-comet-2' >
                                {
                                    buttonIcon1 && (<Image src={buttonIcon1} alt='feature' width={20} height={20} />)
                                } &nbsp; {buttonText}
                            </Button>
                            <Button onClick={() => {
                                navigator.clipboard.writeText(link);
                                toast({ title: 'Link Copied' })
                            }}
                                className='rounded-full border border-white/15 bg-white/5 px-6 text-white hover:bg-white/10'
                            >
                                <Image src='/icons/copy.svg' alt='Copy Icon' width={20} height={20} />
                                &nbsp;
                                Copy Link
                            </Button>
                        </div>
                    )
                }
            </article>
        </section>
    )
}

export default MeetingCard
