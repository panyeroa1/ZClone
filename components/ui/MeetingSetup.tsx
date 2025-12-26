'use client'
import { DeviceSettings, VideoPreview, useCall } from '@stream-io/video-react-sdk'
import React, { useEffect, useState } from 'react'
import { Button } from './button';


const MeetingSetup = ({ setIsSetupComplete }: { setIsSetupComplete: (value:boolean) => void }) => {
  const [isMicCamToggledOn, setisMicCamToggledOn] = useState(false);

  const call = useCall();

  if (!call) {
    throw new Error("useCall must be used within streamCall component")
  }

  useEffect(() => {
    if (isMicCamToggledOn) {
      call?.camera.disable();
      call?.microphone.disable();
    } else {
      call?.camera.enable();
      call?.microphone.enable();
    }
  }, [isMicCamToggledOn, call?.camera, call?.microphone])



  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 px-6 text-white">
      <div className="orbit-panel flex w-full max-w-3xl flex-col gap-6 rounded-3xl px-6 py-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-mist-2">Pre-flight check</p>
          <h1 className="font-display text-3xl font-semibold">Ready to join</h1>
          <p className="text-sm text-mist-2">Confirm your camera and mic before you enter the room.</p>
        </div>
        <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-orbit-3/70">
          <VideoPreview />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-mist-2">
            <input type="checkbox" checked={isMicCamToggledOn} onChange={(e) => setisMicCamToggledOn(e.target.checked)} className="size-4 rounded border-white/20 bg-orbit-2 text-comet-1" />
            Join with mic and camera off
          </label>
          <DeviceSettings />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button className='rounded-full bg-comet-1 px-6 text-white shadow-orbit-soft hover:bg-comet-2' onClick={() => {
            call.join();
            setIsSetupComplete(true);
          }} >
            Join Meeting
          </Button>
        </div>
      </div>
    </div>
  )
}

export default MeetingSetup
