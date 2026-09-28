import { ArrowLeftIcon, FilmIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getBrandKit, logoUrlFor } from "@/features/brand-kits"
import {
  clipMediaUrls,
  DeleteClipButton,
  FootageEditor,
  formatDuration,
  getFootage,
  presentationFor,
  RefreshWhileProcessing,
} from "@/features/footage"
import { getProjectName } from "@/features/projects"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { LinkButton } from "@/shared/ui/link-button"
import { Spinner } from "@/shared/ui/spinner"

export const metadata: Metadata = { title: "Footage editor" }

/** "https://www.acme.app/pricing" → "acme.app" (for end cards). */
function siteLabelFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export default async function FootageEditorPage({
  params,
  searchParams,
}: PageProps<"/brand-kits/[kitId]/footage/[footageId]">) {
  const { kitId, footageId } = await params
  const { video: videoId } = await searchParams
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const [kit, clip, project] = await Promise.all([
    getBrandKit(workspace.id, kitId),
    getFootage(workspace.id, footageId),
    typeof videoId === "string" ? getProjectName(workspace.id, videoId) : null,
  ])
  if (!kit || !clip || clip.brandKitId !== kitId) notFound()
  // Edited as part of a video. A one-clip video lives here: back goes to
  // Videos. From a longer video's clip list, back returns to that list.
  const single = project?.clipCount === 1
  const backTo = project
    ? single
      ? { href: "/videos", label: "Videos" }
      : { href: `/videos/${project.id}`, label: project.name }
    : null
  const video = project
    ? {
        name: project.name,
        single,
        addClipHref: `/videos/${project.id}?clips=1`,
      }
    : null

  const canEdit = can(role, "content:edit")
  const colors = kit.colors
  const brandColors = [colors.primary, colors.secondary, colors.accent].filter(
    (color): color is string => Boolean(color)
  )

  const header = {
    start: (
      <>
        <LinkButton
          href={`/brand-kits/${kitId}/footage`}
          variant="ghost"
          icon={<ArrowLeftIcon />}
        >
          <span className="hidden sm:inline">Footage</span>
          <span className="sr-only sm:hidden">Back to footage</span>
        </LinkButton>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="truncate text-sm font-semibold">{clip.name}</h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {kit.name}
            {clip.durationMs !== null &&
              ` · ${formatDuration(clip.durationMs)}`}
          </p>
        </div>
      </>
    ),
    end: canEdit ? (
      <DeleteClipButton
        footageId={clip.id}
        clipName={clip.name}
        kitId={kitId}
      />
    ) : null,
  }

  if (clip.status === "READY") {
    const media = await clipMediaUrls(clip)
    if (media.videoUrl) {
      return (
        <FootageEditor
          clip={clip}
          videoUrl={media.videoUrl}
          posterUrl={media.posterUrl}
          thumbnailsUrl={media.thumbnailsUrl}
          initialPresentation={presentationFor(clip.presentation, colors)}
          brandColors={brandColors}
          readOnly={!canEdit}
          kitId={kitId}
          kitName={kit.name}
          kitFonts={kit.fonts}
          kitLogoUrl={await logoUrlFor(kit.logoKey)}
          kitSite={siteLabelFor(kit.url)}
          backTo={backTo}
          video={video}
        />
      )
    }
  }

  // Not ready: the same top bar over a message.
  const isWorking = clip.status === "UPLOADING" || clip.status === "PROCESSING"
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <RefreshWhileProcessing active={isWorking} />
      <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
        {header.start}
        <div className="ml-auto">{header.end}</div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center p-6 outline-none"
      >
        <div className="w-full max-w-lg">
          {clip.status === "FAILED" ? (
            <Alert variant="destructive">
              <AlertTitle>We couldn’t use this clip</AlertTitle>
              <AlertDescription>
                {clip.errorMessage ?? "Something went wrong. Upload it again."}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              {isWorking ? <Spinner /> : <FilmIcon />}
              <AlertTitle>
                {clip.status === "UPLOADING"
                  ? "Uploading"
                  : "Processing your clip"}
              </AlertTitle>
              <AlertDescription>
                We’re converting it and finding key moments. This usually takes
                under a minute; this page updates on its own.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </main>
    </div>
  )
}
