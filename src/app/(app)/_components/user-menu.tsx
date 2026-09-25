"use client"

import { BuildingIcon, ChevronsUpDownIcon, UserIcon } from "lucide-react"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar"
import { Button } from "@/shared/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { SidebarMenuButton, useSidebar } from "@/shared/ui/sidebar"

import { userMenuItemClass } from "./nav-config"

export type MenuUser = {
  name: string
  email: string
  image: string | null | undefined
}

function initials({ name, email }: MenuUser) {
  return (name.trim() || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function UserAvatar({
  user,
  size,
}: {
  user: MenuUser
  size?: "default" | "lg"
}) {
  return (
    <Avatar size={size}>
      {user.image && <AvatarImage src={user.image} alt="" />}
      <AvatarFallback>{initials(user)}</AvatarFallback>
    </Avatar>
  )
}

function UserSummary({ user }: { user: MenuUser }) {
  return (
    <div className="grid min-w-0 flex-1 text-left leading-tight">
      <span className="truncate text-sm font-medium text-foreground">
        {user.name || "Add your name"}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {user.email}
      </span>
    </div>
  )
}

/**
 * The one user menu, used by both the sidebar and the header. `signOutItem`
 * is rendered by the server layout: importing it here would pull the auth
 * slice's server-only code into the browser (build plan §5.3).
 */
export function UserMenu({
  user,
  signOutItem,
  variant,
}: {
  user: MenuUser
  signOutItem: React.ReactNode
  variant: "sidebar" | "header"
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobileSidebar = () => isMobile && setOpenMobile(false)

  const trigger =
    variant === "sidebar" ? (
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
        }
      >
        <UserAvatar user={user} />
        <UserSummary user={user} />
        <ChevronsUpDownIcon className="ml-auto" />
      </DropdownMenuTrigger>
    ) : (
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label="Open user menu"
          />
        }
      >
        <UserAvatar user={user} />
      </DropdownMenuTrigger>
    )

  return (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent
        className="w-65 p-1.5"
        side={variant === "sidebar" && !isMobile ? "right" : "bottom"}
        align="end"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2.5 font-normal">
            <UserAvatar user={user} size="lg" />
            <UserSummary user={user} />
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className={userMenuItemClass}
            render={
              <Link href="/settings/profile" onClick={closeMobileSidebar} />
            }
          >
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className={userMenuItemClass}
            render={
              <Link href="/settings/workspace" onClick={closeMobileSidebar} />
            }
          >
            <BuildingIcon />
            Workspace settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuGroup>{signOutItem}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
