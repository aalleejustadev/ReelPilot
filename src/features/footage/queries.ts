import "server-only"

import { db } from "@/shared/db"

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
        select: { id: true, atMs: true, label: true, source: true },
      },
    },
  })
}

export type FootageDetail = NonNullable<Awaited<ReturnType<typeof getFootage>>>
export type FootageListItem = Awaited<ReturnType<typeof listFootage>>[number]
