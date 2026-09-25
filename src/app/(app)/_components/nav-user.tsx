"use client"

import { ChevronsUpDownIcon, UserIcon, BuildingIcon } from "lucide-react"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar"

export type NavUserProps = {
  name: string
  email: string
  image: string | null | undefined
}

function initials({ name, email }: NavUserProps) {
  return (name.trim() || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function UserSummary(user: NavUserProps) {
  return (
    <>
      <Avatar>
        {user.image && <AvatarImage src={user.image} alt="" />}
        <AvatarFallback>{initials(user)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">
          {user.name || "Add your name"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {user.email}
        </span>
      </div>
    </>
  )
}

/**
 * `signOutItem` is rendered by the server layout and passed in: importing
 * it here would pull the auth slice's server-only code into the browser.
 */
export function NavUser({
  signOutItem,
  ...user
}: NavUserProps & { signOutItem: React.ReactNode }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => isMobile && setOpenMobile(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <UserSummary {...user} />
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <UserSummary {...user} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href="/settings/profile" onClick={closeMobile} />}
              >
                <UserIcon />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link href="/settings/workspace" onClick={closeMobile} />
                }
              >
                <BuildingIcon />
                Workspace settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>{signOutItem}</DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
