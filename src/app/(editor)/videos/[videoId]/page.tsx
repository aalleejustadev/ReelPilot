import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import {
  footageLimitsFor,
  listFootage,
  withPosterUrls,
} from "@/features/footage"
import {
  getProject,
  ProjectEditor,
  RefreshWhenClipsReady,
} from "@/features/projects"
import { can, requireWorkspaceAccess } from "@/features/workspaces"

export const metadata: Metadata = { title: "Video" }

export default async function VideoPage({
  params,
  searchParams,
}: PageProps<"/videos/[videoId]">) {
  const { videoId } = await params
  const { clips: showClips } = await searchParams
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const video = await getProject(workspace.id, videoId)
  if (!video) notFound()

  // A one-clip video is edited in the clip editor itself; its clip list
  // opens only when asked for ("Add clip").
  const only = video.clips.length === 1 ? video.clips[0]! : null
  if (only?.status === "READY" && showClips !== "1") {
    redirect(
      `/brand-kits/${video.kit.id}/footage/${only.footageId}?video=${video.id}`
    )
  }

  const kitClips = await withPosterUrls(
    await listFootage(workspace.id, video.kit.id)
  )
  const limits = footageLimitsFor(workspace.plan)

  return (
    <>
      {/* A clip recorded or uploaded here plays once processed. */}
      <RefreshWhenClipsReady
        projectId={video.id}
        statuses={video.clips.map((clip) => clip.status)}
      />
      <ProjectEditor
        project={video}
        kitClips={kitClips.map((clip) => ({
          id: clip.id,
          name: clip.name,
          status: clip.status,
          durationMs: clip.durationMs,
          posterUrl: clip.posterUrl,
        }))}
        footage={{
          maxBytes: limits.maxBytes,
          maxDurationSeconds: limits.maxDurationSeconds,
          canAdd:
            can(role, "content:create") &&
            kitClips.length < limits.clipsPerBrandKit,
        }}
        readOnly={!can(role, "content:edit")}
      />
    </>
  )
}
