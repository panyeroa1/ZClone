'use client'
import React, { useState } from 'react'
import HomeCard from './HomeCard'
import { useRouter } from 'next/navigation'
import MeetingModal from './MeetingModal'
import { useUser } from '@clerk/nextjs'
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk'
import { useToast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"
import ReactDatePicker from 'react-datepicker';
import { Input } from "@/components/ui/input"

const MeetingTypeList = () => {
    const router = useRouter();
    const [meetingState, setmeetingState] = useState<'isScheudleMeeting' | 'isJoiningMeeting' | 'isInstantMeeting' | undefined>();
    const { user } = useUser();
    const client = useStreamVideoClient();
    const [values, setValues] = useState({ dateTime: new Date(), description: "", link: '' })
    const [callDetails, setCallDetails] = useState<Call>();
    const { toast } = useToast();

    const creatingMeeting = async () => {
        if (!user || !client) return;
        try {

            if (!values.dateTime) {
                toast({
                    title: "Please select a date and time",
                })
                return;
            }

            const id = crypto.randomUUID();
            const call = client.call('default', id);

            if (!call) throw new Error('Failed to create call');

            const startsAt = values.dateTime.toISOString() || new Date(Date.now()).toISOString();
            const description = values.description || "Instant meeting";
            await call.getOrCreate({
                data: {
                    starts_at: startsAt,
                    custom: {
                        description,
                    }
                }
            })

            setCallDetails(call);

            if (!values.description) {
                router.push(`/meeting/${call.id}`)
            }
            toast({
                title: "Meeting Created",
            })

        } catch (error) {
            console.log(error);
            toast({
                title: "Failed to create meeting",
            })
        }
    }
    
 const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${callDetails?.id}`;

    return (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <HomeCard img="/icons/add-meeting.svg" title="New Meeting" description="Start an instant room" handleClick={() => setmeetingState('isInstantMeeting')} className='orbit-rise orbit-rise-delay-1' accentClass='bg-ember-1/35' />
            <HomeCard img="/icons/schedule.svg" title="Schedule Meeting" description="Plan your session" handleClick={() => setmeetingState("isScheudleMeeting")} className='orbit-rise orbit-rise-delay-2' accentClass='bg-comet-1/35' />
            <HomeCard img="/icons/recordings.svg" title="View Recordings" description="Replay the highlights" handleClick={() => router.push('/recordings')} className='orbit-rise orbit-rise-delay-3' accentClass='bg-aurora-1/35' />
            <HomeCard img="/icons/join-meeting.svg" title="Join Meeting" description="Enter with an invite link" handleClick={() => setmeetingState('isJoiningMeeting')} className='orbit-rise orbit-rise-delay-4' accentClass='bg-coral-1/35' />


            {
                !callDetails ?
                    (

                        <MeetingModal isOpen={meetingState === 'isScheudleMeeting'} onClose={() => setmeetingState(undefined)} title="Create Meeting" className="text-center" buttonText="Start Meeting"
                            handleClick={creatingMeeting}
                        >
                            <div className="flex flex-col gap-2.5">
                                <label className="text-sm font-medium uppercase tracking-[0.2em] text-mist-2">Add a description</label>
                                <Textarea className='border-white/10 bg-orbit-3 text-sm text-white focus-visible:ring-1 focus-visible:ring-comet-1 focus-visible:ring-offset-0' onChange={(e) => setValues({ ...values, description: e.target.value })} />

                            </div>
                            <div className="flex w-full flex-col gap-2.5 ">
                                <label className="text-sm font-medium uppercase tracking-[0.2em] text-mist-2">Select date and time</label>
                                <ReactDatePicker selected={values.dateTime} onChange={(date) => setValues({ ...values, dateTime: date! })} showTimeSelect timeFormat='HH:mm' timeIntervals={15} timeCaption='time' dateFormat='MMMM d, yyyy h:mm aa' className='w-full rounded-xl border border-white/10 bg-orbit-2 p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-comet-1' />

                            </div>
                        </MeetingModal>
                    ) :
                    (
                        <MeetingModal isOpen={meetingState === 'isScheudleMeeting'} onClose={() => setmeetingState(undefined)} title="Meeting Created" className="text-center" buttonText="Copy Meeting Link" image='/icons/checked.svg' buttonIcon='/icons/copy.svg' handleClick={() => {
                            navigator.clipboard.writeText(meetingLink)
                            toast({title:'Link Copied'})
                        }} />
                    )
            }



            <MeetingModal isOpen={meetingState === 'isInstantMeeting'} onClose={() => setmeetingState(undefined)} title="Start an Instant Meeting" className="text-center" buttonText="Start Meeting" handleClick={creatingMeeting} />
            
            <MeetingModal isOpen={meetingState === 'isJoiningMeeting'} onClose={() => setmeetingState(undefined)} title="Type the link here" className="text-center" buttonText="Join Meeting" handleClick={() => router.push(values.link)} >
                <Input placeholder='Meeting Link' className='border-white/10 bg-orbit-3 text-sm text-white focus-visible:ring-1 focus-visible:ring-comet-1 focus-visible:ring-offset-0' onChange={(e) => setValues({...values, link:e.target.value})} /> 
            </MeetingModal>
        </section>
    )
}

export default MeetingTypeList
