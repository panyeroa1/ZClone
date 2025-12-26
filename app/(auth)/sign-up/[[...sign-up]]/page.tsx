import { SignUp } from '@clerk/nextjs'
import React from 'react'

const SignUpPage = () => {
    return (
        <main className='flex-center h-screen w-full px-6'>
            <div className='orbit-rise'>
                <SignUp />
            </div>
        </main>
    )
}

export default SignUpPage
