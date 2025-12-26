import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster"
import EntryLogoSplash from "@/components/ui/EntryLogoSplash";
import '@stream-io/video-react-sdk/dist/css/styles.css';
import 'react-datepicker/dist/react-datepicker.css';

export const metadata: Metadata = {
  title: "Orbit Conference",
  description: "Orbit Conference video collaboration hub.",
  icons:{
    icon:'/images/watermark.svg'
  }
};

import { Roboto } from "next/font/google";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
  variable: "--font-roboto",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <ClerkProvider appearance={{ layout: { logoImageUrl: '/images/watermark.svg', socialButtonsVariant: 'iconButton' }, variables: { colorText: '#FFFFFF', colorPrimary: '#1776F2', colorBackground: '#131519', colorInputBackground: '#2b303b', colorInputText: '#FFFFFF' } }}>
        <body className={`${roboto.variable} orbit-shell font-sans antialiased`}>
          <EntryLogoSplash />
          {children}
          <Toaster/>
        </body>
      </ClerkProvider>
    </html>
  );
}
