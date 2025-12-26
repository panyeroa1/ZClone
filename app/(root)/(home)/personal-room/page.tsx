'use client'
import React from 'react'
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/components/ui/use-toast';
import Image from 'next/image';
import { useGetCallById } from '@/hooks/useGetCallById';
import { useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';


const Table = ({ title, description }: { title: string; description: string; }) => (
  <div className='flex flex-col items-start gap-2 xl:flex-row' >
    <h1 className='text-xs font-semibold uppercase tracking-[0.2em] text-mist-2 lg:text-sm xl:min-w-40' >{title}</h1>
    <h1 className='truncate text-sm font-semibold text-white max-sm:max-w-[320px] lg:text-base' >{description}</h1>
  </div>
)

const PersonalRoom = () => {
  const { user } = useUser();
  const meetingId = user?.id;
  const { toast } = useToast();
  const client = useStreamVideoClient();
  const { call } = useGetCallById(meetingId!);
  const router = useRouter();
  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meetingId}?personal=true`;
  
  const startRoom = async () => {

    if (!client || !user) return;

    if (!call) {
      const newCall = client.call('default', meetingId!);
      await newCall.getOrCreate({
        data: {
          starts_at: new Date().toISOString(),
        }
      })
    }
    router.push(`/meeting/${meetingId}?personal=true`);

  }

  return (
    <section className='flex size-full flex-col gap-8 text-white'>
      <div className='flex flex-col gap-2'>
        <p className='text-xs uppercase tracking-[0.3em] text-mist-2'>Personal space</p>
        <h1 className='font-display text-3xl font-semibold'>Personal Room</h1>
      </div>
      <div className="orbit-card flex w-full flex-col gap-6 rounded-2xl px-6 py-6 xl:max-w-[900px]">
        <Table title='Topic' description={`${user?.fullName}'s Orbit Room`} />
        <Table title='Meeting ID' description={meetingId!} />
        <Table title='Invite Link' description={meetingLink} />
      </div>
      <div className='flex flex-wrap gap-4' >
        <Button className='rounded-full bg-comet-1 px-6 text-white shadow-orbit-soft hover:bg-comet-2' onClick={() => startRoom()} >
          Start Meeting
        </Button>

        <Button className='rounded-full border border-white/15 bg-white/5 px-6 text-white hover:bg-white/10' onClick={() => {
          navigator.clipboard.writeText(meetingLink);
          toast({ title: 'Link Copied' })
        }} >
          Copy Invitation
          <Image src='/icons/copy.svg' alt='copy icon' width={20} height={20} className='ml-2' />
        </Button>
      </div>
    </section>
  )
}

export default PersonalRoom
