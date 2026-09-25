"use client"

import { BuildingIcon, UserIcon } from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"

import { Spinner } from "@/shared/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"

const tabs = [
  { href: "/settings/profile", label: "Profile", icon: UserIcon },
  { href: "/settings/workspace", label: "Workspace", icon: BuildingIcon },
]

/**
 * shadcn Tabs whose triggers are real links, so each tab has its own URL.
 * The active tab follows the current path.
 */
export function SettingsNav() {
  const pathname = usePathname()

  return (
    <Tabs value={pathname}>
      <TabsList aria-label="Settings">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.href}
            value={tab.href}
            nativeButton={false}
            render={<Link href={tab.href} />}
          >
            <TabIcon icon={tab.icon} />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

// Icon becomes a spinner while the tab's page loads (build plan §12.5);
// same size, so the tab doesn't change width.
function TabIcon({ icon: Icon }: { icon: React.ComponentType }) {
  const { pending } = useLinkStatus()
  return pending ? <Spinner /> : <Icon />
}
