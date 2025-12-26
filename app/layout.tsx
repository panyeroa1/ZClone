import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster"
import EntryLogoSplash from "@/components/ui/EntryLogoSplash";
import '@stream-io/video-react-sdk/dist/css/styles.css';
import 'react-datepicker/dist/react-datepicker.css';
const orbitSans = DM_Sans({ subsets: ["latin"], variable: "--font-orbit-sans" });
const orbitDisplay = Space_Grotesk({ subsets: ["latin"], variable: "--font-orbit-display" });
export const metadata: Metadata = {
  title: "Orbit Conference",
  description: "Orbit Conference video collaboration hub.",
  icons:{
    icon:'/images/watermark.svg'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <ClerkProvider appearance={{ layout: { logoImageUrl: '/images/watermark.svg', socialButtonsVariant: 'iconButton' }, variables: { colorText: '#E4ECFF', colorPrimary: '#2F80FF', colorBackground: '#0B111F', colorInputBackground: '#17213A', colorInputText: '#E4ECFF' } }}>
        <body className={`${orbitSans.variable} ${orbitDisplay.variable} orbit-shell font-sans antialiased`}>
          <EntryLogoSplash />
          {children}
          <Toaster/>
        </body>
      </ClerkProvider>
    </html>
  );
}
