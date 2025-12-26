'use client';

import React from 'react';
import { useCallStateHooks } from '@stream-io/video-react-sdk';
import { Volume2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SpeakerSelector = () => {
  const { useSpeakerState } = useCallStateHooks();
  const { speaker, isDeviceSelectionSupported, devices, selectedDevice } = useSpeakerState();

  if (!isDeviceSelectionSupported || !devices || devices.length === 0) return null;

  return (
    <DropdownMenu>
      <div className="flex items-center">
        <DropdownMenuTrigger
          className="rounded-full border border-white/15 bg-white/5 p-3 text-white transition hover:bg-white/10"
          title="Speaker Output"
        >
          <Volume2 size={18} className="text-white" />
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="border-white/10 bg-orbit-2 text-white">
        {devices.map((device, index) => (
          <div key={device.deviceId || index}>
            <DropdownMenuItem
              className="cursor-pointer font-semibold focus:bg-white/10"
              onClick={() => speaker.select(device.deviceId)}
            >
              {device.label || `Speaker ${index + 1}`}
              {selectedDevice === device.deviceId && " (Selected)"}
            </DropdownMenuItem>
            {index < devices.length - 1 && <DropdownMenuSeparator className="border-white/10" />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SpeakerSelector;
