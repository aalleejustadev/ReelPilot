"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/shared/ui/separator"
import { SidebarTrigger } from "@/shared/ui/sidebar"

import { titleFor } from "./nav-config"
import { UserMenu, type MenuUser } from "./user-menu"

export function AppHeader({
  user,
  signOutItem,
}: {
  user: MenuUser
  signOutItem: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-6 md:px-8">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 data-vertical:h-4 data-vertical:self-auto"
      />
      <span className="text-sm font-medium">{titleFor(pathname)}</span>
      <div className="ml-auto">
        <UserMenu user={user} signOutItem={signOutItem} variant="header" />
      </div>
    </header>
  )
}
