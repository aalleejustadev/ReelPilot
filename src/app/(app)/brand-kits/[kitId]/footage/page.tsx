import { FilmIcon } from "lucide-react"
import type { Metadata } from "next"

import {
  FootageGrid,
  FootageUploader,
  footageLimitsFor,
  footageUsage,
  listFootage,
  RefreshWhileProcessing,
  ScreenRecorder,
  withPosterUrls,
} from "@/features/footage"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
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

  const limits = footageLimitsFor(workspace.plan)
  const canAdd = can(role, "content:create")
  const atLimit = clips.length >= limits.clipsPerBrandKit
  const isWorking = clips.some(
    (clip) => clip.status === "UPLOADING" || clip.status === "PROCESSING"
  )

  return (
    <div className="flex flex-col gap-8">
      <RefreshWhileProcessing active={isWorking} />
      {canAdd &&
        (atLimit ? (
          <Alert>
            <AlertTitle>You’ve used every clip on your plan</AlertTitle>
            <AlertDescription>
              {footageUsage(workspace.plan, clips.length)} Delete one to add
              another.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Add footage</CardTitle>
              <CardDescription>
                Record your app or upload a screen recording. We turn it into
                clips and find the key moments.{" "}
                {footageUsage(workspace.plan, clips.length)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ScreenRecorder
                kitId={kitId}
                maxBytes={limits.maxBytes}
                maxDurationSeconds={limits.maxDurationSeconds}
              />
              <FootageUploader
                kitId={kitId}
                maxBytes={limits.maxBytes}
                disabled={false}
              />
            </CardContent>
          </Card>
        ))}

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
        <FootageGrid clips={clips} kitId={kitId} />
      )}
    </div>
  )
}
