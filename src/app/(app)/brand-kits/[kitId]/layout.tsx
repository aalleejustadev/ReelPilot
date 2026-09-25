import { notFound } from "next/navigation"

import { getBrandKit } from "@/features/brand-kits"
import { requireWorkspaceAccess } from "@/features/workspaces"

import { KitTabs } from "./_kit-tabs"

export default async function BrandKitLayout({
  params,
  children,
}: LayoutProps<"/brand-kits/[kitId]">) {
  const { kitId } = await params
  const { workspace } = await requireWorkspaceAccess("workspace:view")
  const kit = await getBrandKit(workspace.id, kitId)
  if (!kit) notFound()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
          {kit.name}
        </h1>
        <p className="truncate text-muted-foreground">
          {new URL(kit.url).hostname.replace(/^www\./, "")}
        </p>
      </div>
      <KitTabs kitId={kit.id} />
      {children}
    </div>
  )
}
