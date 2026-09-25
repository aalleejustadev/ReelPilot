import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrandKitEditor, getBrandKit, logoUrlFor } from "@/features/brand-kits"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"

export const metadata: Metadata = { title: "Brand kit" }

export default async function BrandKitPage({
  params,
  searchParams,
}: PageProps<"/brand-kits/[kitId]">) {
  const { kitId } = await params
  const { draft } = await searchParams
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")

  const kit = await getBrandKit(workspace.id, kitId)
  if (!kit) notFound()
  const logoUrl = await logoUrlFor(kit.logoKey)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {draft === "partial" && (
        <Alert>
          <AlertTitle>We filled in what we could</AlertTitle>
          <AlertDescription>
            We read your site but couldn’t draft the full brief. Add your
            audience, features and claims below, then save.
          </AlertDescription>
        </Alert>
      )}
      <BrandKitEditor
        kit={kit}
        logoUrl={logoUrl}
        readOnly={!can(role, "content:edit")}
      />
    </div>
  )
}
