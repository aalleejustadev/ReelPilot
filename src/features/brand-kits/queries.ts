import "server-only"

import { cache } from "react"

import { db } from "@/shared/db"
import { signedFileUrl } from "@/shared/storage"

import { parseStoredColors, parseStoredFonts } from "./lib/kit-record"

/** The workspace's kits, oldest first (the order they were created). */
export async function listBrandKits(workspaceId: string) {
  return db.brandKit.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      description: true,
      logoKey: true,
      updatedAt: true,
      _count: { select: { footage: true } },
    },
  })
}

/**
 * One kit with its claims in editor order, or null if not in this workspace.
 * Cached per request: the kit layout and its pages both read it.
 */
export const getBrandKit = cache(async (workspaceId: string, kitId: string) => {
  const kit = await db.brandKit.findFirst({
    where: { id: kitId, workspaceId },
    include: {
      claims: {
        orderBy: { position: "asc" },
        select: { text: true, sourceUrl: true },
      },
    },
  })
  if (!kit) return null
  return {
    ...kit,
    colors: parseStoredColors(kit.colors),
    fonts: parseStoredFonts(kit.fonts),
  }
})

export type BrandKitDetail = NonNullable<
  Awaited<ReturnType<typeof getBrandKit>>
>

/** A signed, one-hour link to a kit's logo (the bucket is private). */
export async function logoUrlFor(logoKey: string | null) {
  return logoKey ? signedFileUrl(logoKey, 60 * 60) : null
}
