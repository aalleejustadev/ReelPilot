"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar"
import { Spinner } from "@/shared/ui/spinner"

import { isActive, navItems } from "./nav-config"

export function NavMain() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarMenu className="gap-1.5">
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={
                <Link
                  href={item.href}
                  // Close the mobile sheet once the user picks a page.
                  onClick={() => isMobile && setOpenMobile(false)}
                />
              }
              isActive={isActive(pathname, item.href)}
              className="h-9"
              tooltip={item.title}
            >
              <NavIcon icon={item.icon} />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

// Swaps the icon for a spinner while the page loads (build plan §12.5).
function NavIcon({ icon: Icon }: { icon: React.ComponentType }) {
  const { pending } = useLinkStatus()
  return pending ? <Spinner /> : <Icon />
}
