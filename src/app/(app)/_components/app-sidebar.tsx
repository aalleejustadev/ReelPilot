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
import { UserMenu, type MenuUser } from "./user-menu"

// Follows shadcn's sidebar-07 block: collapses to icons on desktop and
// becomes a sheet on mobile. The roomier padding applies only when expanded:
// the collapsed rail is 48px and needs shadcn's 8px to centre 32px icons.
export function AppSidebar({
  workspaceName,
  user,
  signOutItem,
}: {
  workspaceName: string
  user: MenuUser
  signOutItem: React.ReactNode
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
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
      <SidebarContent className="px-1 group-data-[collapsible=icon]:px-0">
        <NavMain />
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} signOutItem={signOutItem} variant="sidebar" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
