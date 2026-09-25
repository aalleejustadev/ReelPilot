import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@/shared/styles/globals.css"
import { site } from "@/shared/config/site"
import { cn } from "@/shared/lib/utils"
import { Toaster } from "@/shared/ui/toast"
import { TooltipProvider } from "@/shared/ui/tooltip"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

// Timecodes and credit counts
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased", fontSans.variable, fontMono.variable)}
    >
      <body>
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </body>
    </html>
  )
}
