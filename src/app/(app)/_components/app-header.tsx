"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/shared/ui/separator"
import { SidebarTrigger } from "@/shared/ui/sidebar"

import { titleFor } from "./nav-config"

export function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 data-vertical:h-4 data-vertical:self-auto"
      />
      <span className="text-sm font-medium">{titleFor(pathname)}</span>
    </header>
  )
}
