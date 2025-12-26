'use client';
import React, { useState } from 'react'
import { cn } from '@/lib/utils';
import { CallControls, CallParticipantsList, CallStatsButton, CallingState, PaginatedGridLayout, SpeakerLayout, useCallStateHooks } from '@stream-io/video-react-sdk';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Languages, LayoutList, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import EndCallButton from './EndCallButton';
import Loader from './Loader';
import TranslatorPanel from './TranslatorPanel';
import CaptionsOverlay from './CaptionsOverlay';
import { useRealtimeTranslator } from '@/hooks/useRealtimeTranslator';
import SpeakerSelector from './SpeakerSelector';

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right' | 'speaker-bottom';
const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const [layout, setlayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setshowParticipants] = useState(false);
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const router = useRouter();
  const translator = useRealtimeTranslator();
  if(callingState !== CallingState.JOINED) return <Loader/>
  const CallLayout = () => {
    switch (layout) {
      case 'grid': return <PaginatedGridLayout />
      case 'speaker-right': return <SpeakerLayout participantsBarPosition='left' />
      case 'speaker-bottom': return <SpeakerLayout participantsBarPosition='bottom' />
      default: return <SpeakerLayout participantsBarPosition='right' />
    }
  }


  return (
    <section className="relative h-screen w-full overflow-hidden pt-6 text-white">
      <CaptionsOverlay enabled={translator.settings.captionsEnabled} items={translator.captions} />
      <div className="relative flex size-full items-center justify-center">
        <div className="flex size-full items-center">
          <CallLayout />
        </div>
        <div className={cn("ml-3 hidden h-[calc(100vh-120px)]", { 'show-block': showParticipants })}>
          <CallParticipantsList onClose={() => setshowParticipants(false)} />
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-20 flex w-[min(100%,900px)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-orbit-1/70 px-4 py-3 backdrop-blur">
        <CallControls onLeave={() => router.push('/')  } />
        <button
          onClick={() => setIsTranslatorOpen(true)}
          className="rounded-full border border-white/15 bg-white/5 p-3 text-white transition hover:bg-white/10"
          title="Realtime translator"
          type="button"
        >
          <Languages size={18} className="text-white" />
        </button>
        <SpeakerSelector /> 
        <DropdownMenu>
          <div className="flex items-center">
            <DropdownMenuTrigger className='rounded-full border border-white/15 bg-white/5 p-3 text-white transition hover:bg-white/10' >
              <LayoutList size={18} className='text-white' />
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent className='border-white/10 bg-orbit-2 text-white' >
            {['Grid', 'Speaker-Left', 'Speaker-Right', 'Speaker-Bottom'].map((item, index) => (
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
        <button onClick={() => setshowParticipants((prev) => !prev)} className="rounded-full border border-white/15 bg-white/5 p-3 text-white transition hover:bg-white/10" title="Participants">
          <Users size={18} className='text-white' />
        </button>
        {!isPersonalRoom && <EndCallButton />}
      </div>

      <TranslatorPanel
        isOpen={isTranslatorOpen}
        onClose={() => setIsTranslatorOpen(false)}
        translator={{
          ...translator,
          audioOutputs: translator.audioOutputs.map((d) => ({ deviceId: d.deviceId, label: d.label })),
        }}
      />

      <audio ref={translator.translatedAudioRef} className="hidden" />
    </section>
  )
}

export default MeetingRoom
