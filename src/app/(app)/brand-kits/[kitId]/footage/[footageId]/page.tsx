import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  ClipEditor,
  clipMediaUrls,
  DeleteClipButton,
  formatDuration,
  getFootage,
  RefreshWhileProcessing,
} from "@/features/footage"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { LinkButton } from "@/shared/ui/link-button"
import { Spinner } from "@/shared/ui/spinner"

export const metadata: Metadata = { title: "Clip" }

export default async function ClipPage({
  params,
}: PageProps<"/brand-kits/[kitId]/footage/[footageId]">) {
  const { kitId, footageId } = await params
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const clip = await getFootage(workspace.id, footageId)
  if (!clip || clip.brandKitId !== kitId) notFound()

  const media = await clipMediaUrls(clip)
  const canEdit = can(role, "content:edit")
  const isWorking = clip.status === "UPLOADING" || clip.status === "PROCESSING"

  return (
    <div className="flex flex-col gap-6">
      <RefreshWhileProcessing active={isWorking} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <LinkButton
            href={`/brand-kits/${kitId}/footage`}
            variant="ghost"
            icon={<ArrowLeftIcon />}
          >
            Footage
          </LinkButton>
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {clip.name}
            </h2>
            {clip.durationMs !== null && (
              <p className="font-mono text-sm text-muted-foreground">
                {formatDuration(clip.durationMs)}
                {clip.width && clip.height
                  ? ` · ${clip.width}×${clip.height}`
                  : ""}
              </p>
            )}
          </div>
        </div>
        {canEdit && (
          <DeleteClipButton
            footageId={clip.id}
            clipName={clip.name}
            kitId={kitId}
          />
        )}
      </div>

      {clip.status === "READY" && media.videoUrl ? (
        <ClipEditor
          clip={clip}
          videoUrl={media.videoUrl}
          posterUrl={media.posterUrl}
          thumbnailsUrl={media.thumbnailsUrl}
          readOnly={!canEdit}
        />
      ) : clip.status === "FAILED" ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn’t use this clip</AlertTitle>
          <AlertDescription>
            {clip.errorMessage ?? "Something went wrong. Upload it again."}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Spinner />
          <AlertTitle>
            {clip.status === "UPLOADING" ? "Uploading" : "Processing your clip"}
          </AlertTitle>
          <AlertDescription>
            We’re converting it and finding key moments. This usually takes
            under a minute; this page updates on its own.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
