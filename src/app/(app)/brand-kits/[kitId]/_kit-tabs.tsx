"use client"

import { FileTextIcon, FilmIcon } from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"

import { Spinner } from "@/shared/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"

/** Link tabs for one brand kit, like the settings tabs. */
export function KitTabs({ kitId }: { kitId: string }) {
  const pathname = usePathname()
  const base = `/brand-kits/${kitId}`
  const tabs = [
    { href: base, label: "Details", icon: FileTextIcon },
    { href: `${base}/footage`, label: "Footage", icon: FilmIcon },
  ]
  // A clip's own page keeps the Footage tab selected.
  const active = pathname.startsWith(`${base}/footage`) ? tabs[1] : tabs[0]

  return (
    <Tabs value={active?.href}>
      <TabsList aria-label="Brand kit">
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

function TabIcon({ icon: Icon }: { icon: React.ComponentType }) {
  const { pending } = useLinkStatus()
  return pending ? <Spinner /> : <Icon />
}
