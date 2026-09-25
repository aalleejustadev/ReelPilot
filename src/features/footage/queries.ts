import "server-only"

import { db } from "@/shared/db"
import { signedFileUrl } from "@/shared/storage"

/** A kit's clips, newest first. */
export async function listFootage(workspaceId: string, kitId: string) {
  return db.footage.findMany({
    where: { workspaceId, brandKitId: kitId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      source: true,
      status: true,
      posterKey: true,
      durationMs: true,
      errorMessage: true,
      createdAt: true,
      _count: { select: { markers: true } },
    },
  })
}

/** One clip with its markers in time order, or null if not in the workspace. */
export async function getFootage(workspaceId: string, footageId: string) {
  return db.footage.findFirst({
    where: { id: footageId, workspaceId },
    include: {
      markers: {
        orderBy: { atMs: "asc" },
        select: { id: true, atMs: true, label: true, source: true, shot: true },
      },
    },
  })
}

export type FootageDetail = NonNullable<Awaited<ReturnType<typeof getFootage>>>
export type FootageListItem = Awaited<ReturnType<typeof listFootage>>[number]

/** Adds a signed poster link to each clip (the bucket is private). */
export async function withPosterUrls(clips: FootageListItem[]) {
  return Promise.all(
    clips.map(async (clip) => ({
      ...clip,
      posterUrl: clip.posterKey
        ? await signedFileUrl(clip.posterKey, 3600)
        : null,
    }))
  )
}

/** Signed links for everything the clip page shows. */
export async function clipMediaUrls(clip: FootageDetail) {
  const sign = (key: string | null) => (key ? signedFileUrl(key, 3600) : null)
  const [videoUrl, posterUrl, thumbnailsUrl] = await Promise.all([
    sign(clip.videoKey),
    sign(clip.posterKey),
    sign(clip.thumbnailsKey),
  ])
  return { videoUrl, posterUrl, thumbnailsUrl }
}
