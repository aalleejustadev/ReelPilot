import type { Metadata } from "next"
import { Geist } from "next/font/google"

import "@/shared/styles/globals.css"
import { cn } from "@/shared/lib/utils"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "ReelPilot",
  description: "Turn your app into scroll-stopping video ads in minutes.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("font-sans antialiased", fontSans.variable)}>
      <body>{children}</body>
    </html>
  )
}
