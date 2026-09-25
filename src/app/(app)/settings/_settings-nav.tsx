"use client"

import { usePathname } from "next/navigation"

import { LinkButton } from "@/shared/ui/link-button"

const tabs = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/workspace", label: "Workspace" },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Settings" className="flex gap-1">
      {tabs.map((tab) => {
        const isCurrent = pathname === tab.href
        return (
          <LinkButton
            key={tab.href}
            href={tab.href}
            variant={isCurrent ? "secondary" : "ghost"}
            aria-current={isCurrent ? "page" : undefined}
          >
            {tab.label}
          </LinkButton>
        )
      })}
    </nav>
  )
}
