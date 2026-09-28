import {
  ClapperboardIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  SettingsIcon,
} from "lucide-react"

/**
 * Sidebar items: only pages that exist (§12.4), added as milestones ship.
 * Add each new top-level route to the matcher in src/proxy.ts too.
 */
export const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Videos", href: "/videos", icon: ClapperboardIcon },
  { title: "Brand kits", href: "/brand-kits", icon: PaletteIcon },
  { title: "Settings", href: "/settings", icon: SettingsIcon },
] as const

/** Top bar titles, most specific path first. */
const pageTitles: { prefix: string; title: string }[] = [
  { prefix: "/settings/profile", title: "Profile" },
  { prefix: "/settings/workspace", title: "Workspace" },
  { prefix: "/settings", title: "Settings" },
  { prefix: "/dashboard", title: "Dashboard" },
  { prefix: "/videos", title: "Videos" },
  { prefix: "/brand-kits", title: "Brand kits" },
]

export function titleFor(pathname: string) {
  return pageTitles.find((page) => pathname.startsWith(page.prefix))?.title
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Spacing for every user menu item, including the auth slice's sign-out. */
export const userMenuItemClass = "gap-2.5 px-2 py-2"
