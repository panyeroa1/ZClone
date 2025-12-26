'use client'
import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk'
import React from 'react'
import { Button } from './button';
import { useRouter } from 'next/navigation';


const EndCallButton = () => {
    const call = useCall();
    const router = useRouter();
    const { useLocalParticipant } = useCallStateHooks();
    const localParticipant = useLocalParticipant();
    const isMeetingOwner = localParticipant && call?.state.createdBy && localParticipant.userId === call.state.createdBy.id;

    if (!isMeetingOwner) return null;

    return (
        <Button onClick={async () => { await call.endCall(); router.push('/') }} className='self-center rounded-full bg-coral-1 px-5 text-white hover:bg-coral-2' >
            End call for everyone
        </Button>
    )
}

export default EndCallButton
