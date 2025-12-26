import React, { useState } from 'react'
import { cn } from '@/lib/utils';
import { CallControls, CallParticipantsList, CallStatsButton, CallingState, PaginatedGridLayout, SpeakerLayout, useCallStateHooks } from '@stream-io/video-react-sdk';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutList, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import EndCallButton from './EndCallButton';
import Loader from './Loader';

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';
const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const [layout, setlayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setshowParticipants] = useState(false);
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const router = useRouter();
  if(callingState !== CallingState.JOINED) return <Loader/>
  const CallLayout = () => {
    switch (layout) {
      case 'grid': return <PaginatedGridLayout />
      case 'speaker-right': return <SpeakerLayout participantsBarPosition='left' />
      default: return <SpeakerLayout participantsBarPosition='right' />
    }
  }


  return (
    <section className="relative h-screen w-full overflow-hidden pt-6 text-white">
      <div className="relative flex size-full items-center justify-center">
        <div className="flex size-full max-w-[1100px] items-center">
          <CallLayout />
        </div>
        <div className={cn("ml-3 hidden h-[calc(100vh-120px)]", { 'show-block': showParticipants })}>
          <CallParticipantsList onClose={() => setshowParticipants(false)} />
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-20 flex w-[min(100%,900px)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-orbit-1/70 px-4 py-3 backdrop-blur">
        <CallControls onLeave={() => router.push('/')  } />
        <DropdownMenu>
          <div className="flex items-center">
            <DropdownMenuTrigger className='rounded-full border border-white/15 bg-white/5 p-3 text-white transition hover:bg-white/10' >
              <LayoutList size={18} className='text-white' />
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent className='border-white/10 bg-orbit-2 text-white' >
            {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
              <div key={index}>
                <DropdownMenuItem className='cursor-pointer font-semibold focus:bg-white/10' onClick={() => setlayout(item.toLowerCase() as CallLayoutType)} >
                  {item}
                </DropdownMenuItem>
                <DropdownMenuSeparator className='border-white/10' />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className='self-center rounded-full border border-white/15 bg-white/5 p-2 text-white transition hover:bg-white/10'>
          <CallStatsButton />
        </div>
        <button onClick={() => setshowParticipants((prev) => !prev)} className="rounded-full border border-white/15 bg-white/5 p-3 text-white transition hover:bg-white/10">
          <Users size={18} className='text-white' />
        </button>
        {!isPersonalRoom && <EndCallButton />}
      </div>
    </section>
  )
}

export default MeetingRoom
