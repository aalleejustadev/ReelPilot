import { LayoutDashboardIcon, SettingsIcon } from "lucide-react"

/**
 * Sidebar items: only pages that exist. Campaigns, Library, Brand kits and
 * Presenters (§12.4) are added here as their milestones ship.
 * Add each new top-level route to the matcher in src/proxy.ts too.
 */
export const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Settings", href: "/settings", icon: SettingsIcon },
] as const

/** Top bar titles, most specific path first. */
export const pageTitles: { prefix: string; title: string }[] = [
  { prefix: "/settings/profile", title: "Profile" },
  { prefix: "/settings/workspace", title: "Workspace" },
  { prefix: "/settings", title: "Settings" },
  { prefix: "/dashboard", title: "Dashboard" },
]

export function titleFor(pathname: string) {
  return pageTitles.find((page) => pathname.startsWith(page.prefix))?.title
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
