import React, { ReactNode } from 'react'
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from './button';
interface MeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    className?: string;
    children?: ReactNode;
    handleClick: () => void;
    buttonText?: string;
    image?: string;
    buttonIcon?: string;
}
const MeetingModal = ({ isOpen, onClose, title, className, children, handleClick, buttonText, image, buttonIcon }: MeetingModalProps) => {
    return (

        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className='orbit-panel flex w-full max-w-[520px] flex-col gap-6 rounded-2xl px-7 py-8 text-white'>
                <div className="flex flex-col gap-6">
                    {image && (
                        <div className="flex justify-center">
                            <Image src={image} alt='Image' width={72} height={72} />
                        </div>
                    )}
                    <h1 className={cn('font-display text-3xl font-semibold leading-[42px]', className)} >{title}</h1>
                    {children}
                    <Button className='bg-comet-1 text-white shadow-orbit-soft hover:bg-comet-2 focus-visible:ring-2 focus-visible:ring-comet-1 focus-visible:ring-offset-0' onClick={handleClick}> {buttonIcon && <Image src={buttonIcon} alt='Button icon' width={12} height={12} />}&nbsp; {buttonText || 'Schedule Meeting'}</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default MeetingModal
