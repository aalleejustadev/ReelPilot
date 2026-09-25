"use client"

import { ClapperboardIcon } from "lucide-react"
import Link from "next/link"

import { site } from "@/shared/config/site"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/shared/ui/sidebar"

import { NavMain } from "./nav-main"
import { NavUser, type NavUserProps } from "./nav-user"

// Follows shadcn's sidebar-07 block: collapses to icons on desktop and
// becomes a sheet on mobile.
export function AppSidebar({
  workspaceName,
  user,
  signOutItem,
}: {
  workspaceName: string
  user: NavUserProps
  signOutItem: React.ReactNode
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ClapperboardIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{site.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {workspaceName}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser {...user} signOutItem={signOutItem} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
