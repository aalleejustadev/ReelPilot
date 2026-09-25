import type { Metadata } from "next"
import { Big_Shoulders, Schibsted_Grotesk } from "next/font/google"

import "@/shared/styles/globals.css"
import { site } from "@/shared/config/site"
import { cn } from "@/shared/lib/utils"
import { Toaster } from "@/shared/ui/toast"
import { TooltipProvider } from "@/shared/ui/tooltip"

// UI + body (§12.3)
const fontSans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted-grotesk",
})

// Display. Google merged "Big Shoulders Display" into Big Shoulders; the
// optical-size axis selects the display cut automatically at large sizes.
const fontHeading = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
})

export const metadata: Metadata = {
  title: site.name,
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
      className={cn("antialiased", fontSans.variable, fontHeading.variable)}
    >
      <body>
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </body>
    </html>
  )
}
