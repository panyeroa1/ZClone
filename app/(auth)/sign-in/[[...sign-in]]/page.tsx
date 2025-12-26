import { SignIn } from '@clerk/nextjs'
import React from 'react'
const SignInPage = () => {
  return (
    <main className='flex-center h-screen w-full px-6'>
        <div className='orbit-rise'>
          <SignIn/>
        </div>
    </main>
  )
}

export default SignInPage
