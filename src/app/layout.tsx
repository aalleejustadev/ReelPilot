import type { Metadata } from "next"

import "@/shared/styles/globals.css"
import { site } from "@/shared/config/site"
import { cn } from "@/shared/lib/utils"
import { Toaster } from "@/shared/ui/toast"
import { TooltipProvider } from "@/shared/ui/tooltip"

import { fontMono, fontSans } from "./fonts"

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
