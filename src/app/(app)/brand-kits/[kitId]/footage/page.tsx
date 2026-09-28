import { FilmIcon } from "lucide-react"
import type { Metadata } from "next"

import {
  FootageGrid,
  FootageUploader,
  clipLimits,
  footageUsage,
  listFootage,
  RefreshWhileProcessing,
  ScreenRecorder,
  withPosterUrls,
} from "@/features/footage"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"

export const metadata: Metadata = { title: "Footage" }

export default async function FootagePage({
  params,
}: PageProps<"/brand-kits/[kitId]/footage">) {
  const { kitId } = await params
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  // The kit layout has already checked the kit is in this workspace.
  const clips = await withPosterUrls(await listFootage(workspace.id, kitId))

  const canAdd = can(role, "content:create")
  const isWorking = clips.some(
    (clip) => clip.status === "UPLOADING" || clip.status === "PROCESSING"
  )

  return (
    <div className="flex flex-col gap-8">
      <RefreshWhileProcessing active={isWorking} />
      {canAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add footage</CardTitle>
            <CardDescription>
              Record your app or upload a screen recording. We turn it into
              clips and find the key moments. {footageUsage()}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ScreenRecorder
              kitId={kitId}
              maxBytes={clipLimits.maxBytes}
              maxDurationSeconds={clipLimits.maxDurationSeconds}
            />
            <FootageUploader
              kitId={kitId}
              maxBytes={clipLimits.maxBytes}
              disabled={false}
            />
          </CardContent>
        </Card>
      )}

      {clips.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FilmIcon />
            </EmptyMedia>
            <EmptyTitle>No footage yet</EmptyTitle>
            <EmptyDescription>
              {canAdd
                ? "Record a short walk through your app, or upload a screen recording you already have."
                : "An owner or editor can add footage."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <FootageGrid clips={clips} />
      )}
    </div>
  )
}
