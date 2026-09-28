import { ArrowRightIcon, FilmIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrandKitEditor, getBrandKit, logoUrlFor } from "@/features/brand-kits"
import { countFootage } from "@/features/footage"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/alert"
import { LinkButton } from "@/shared/ui/link-button"

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
  const [logoUrl, clipCount] = await Promise.all([
    logoUrlFor(kit.logoKey),
    countFootage(workspace.id, kit.id),
  ])

  return (
    <div className="flex flex-col gap-8">
      {/* A new kit's next step, so no one has to find the tab. */}
      {clipCount === 0 && can(role, "content:create") && (
        <Alert>
          <FilmIcon />
          <AlertTitle>Next: add your footage</AlertTitle>
          <AlertDescription>
            Record your app or upload a screen recording, then edit it into a
            video.
          </AlertDescription>
          <AlertAction>
            <LinkButton
              href={`/brand-kits/${kit.id}/footage`}
              size="sm"
              icon={<ArrowRightIcon />}
              iconPosition="end"
            >
              Add footage
            </LinkButton>
          </AlertAction>
        </Alert>
      )}
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
