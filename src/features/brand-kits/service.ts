import "server-only"

import { db } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"
import { isWorkspaceFileKey } from "@/shared/storage"

import { toClaimRows, toKitColumns } from "./lib/kit-record"
import type { BrandKitFields } from "./schema"

const kitNotFound = () =>
  new AppError(
    "NOT_FOUND",
    "We couldn’t find that brand kit. It may have been deleted."
  )

/** Creates a kit. Any number are allowed (ReelPilot is free for now). */
export async function createBrandKit(
  workspaceId: string,
  fields: BrandKitFields
) {
  return db.brandKit.create({
    data: {
      workspaceId,
      ...toKitColumns(fields),
      claims: { create: toClaimRows(fields.claims) },
    },
    select: { id: true },
  })
}

/** Saves every field; the claims list is replaced in the order given. */
export async function updateBrandKit(
  workspaceId: string,
  kitId: string,
  fields: BrandKitFields
) {
  await db.$transaction(async (tx) => {
    const { count } = await tx.brandKit.updateMany({
      where: { id: kitId, workspaceId },
      data: toKitColumns(fields),
    })
    if (count === 0) throw kitNotFound()

    await tx.allowedClaim.deleteMany({ where: { brandKitId: kitId } })
    await tx.allowedClaim.createMany({
      data: toClaimRows(fields.claims).map((row) => ({
        ...row,
        brandKitId: kitId,
      })),
    })
  })
  return { id: kitId }
}

/**
 * Points the kit at a new logo (or none). Returns the previous key so the
 * caller can delete that file once the change is saved.
 */
export async function setBrandKitLogo(
  workspaceId: string,
  kitId: string,
  logoKey: string | null
) {
  if (logoKey && !isWorkspaceFileKey(logoKey, workspaceId)) {
    throw new Error("Logo key is outside the workspace")
  }
  return db.$transaction(async (tx) => {
    const kit = await tx.brandKit.findFirst({
      where: { id: kitId, workspaceId },
      select: { logoKey: true },
    })
    if (!kit) throw kitNotFound()

    await tx.brandKit.update({ where: { id: kitId }, data: { logoKey } })
    return { previousLogoKey: kit.logoKey }
  })
}

/** Deletes the kit and its claims. Returns its logo key for file cleanup. */
export async function deleteBrandKit(workspaceId: string, kitId: string) {
  return db.$transaction(async (tx) => {
    const kit = await tx.brandKit.findFirst({
      where: { id: kitId, workspaceId },
      select: { logoKey: true },
    })
    if (!kit) throw kitNotFound()

    await tx.brandKit.delete({ where: { id: kitId } })
    return { logoKey: kit.logoKey }
  })
}
