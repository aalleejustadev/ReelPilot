"use server"

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import { requireWorkspaceAccess } from "@/features/workspaces"
import { aiLimits } from "@/shared/config/plans"
import { AppError } from "@/shared/lib/errors"
import { err, ok, toResultError, type Result } from "@/shared/lib/result"
import { consumeRateLimit } from "@/shared/rate-limit"
import { deleteFolder, workspaceFileKey } from "@/shared/storage"

import { blankFields } from "./lib/draft-fields"
import { draftKitFromUrl } from "./lib/draft-kit"
import { fetchLogo, logoRules, sniffLogoType } from "./lib/logo"
import { deleteOldLogo, storeLogo } from "./lib/store-logo"
import { createFromUrlSchema, kitIdSchema, saveBrandKitSchema } from "./schema"
import * as service from "./service"

// Same pattern as workspaces/actions.ts: validate → authorize → service →
// revalidate, returning a Result; only Next's redirects are rethrown.

/**
 * VALIDATION error keyed by each issue's full path relative to `root`
 * (e.g. "claims.2.sourceUrl"), so the editor can mark the exact field.
 */
function invalid(error: z.ZodError, message: string, root?: string) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.map(String)
    if (root && path[0] === root) path.shift()
    const key = path.join(".") || "form"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return new AppError("VALIDATION", message, { fieldErrors })
}

function refreshKits() {
  revalidatePath("/brand-kits", "layout")
  revalidatePath("/dashboard")
}

export type CreatedKit = { kitId: string; isComplete: boolean }

/**
 * Reads the website, drafts every field with AI, saves the kit and its logo.
 * Limits are checked before the AI call so a full plan never spends one.
 */
export async function createBrandKitFromUrl(
  url: unknown
): Promise<Result<CreatedKit>> {
  try {
    const parsed = createFromUrlSchema.safeParse({ url })
    if (!parsed.success) throw invalid(parsed.error, "Check the address.")

    const { workspace } = await requireWorkspaceAccess("content:create")
    await service.assertRoomForBrandKit(workspace)
    await consumeRateLimit({
      key: `brand-kit-draft:${workspace.id}`,
      limit: aiLimits.brandKitDraftsPerDay,
      windowSeconds: 24 * 60 * 60,
      message: `You’ve drafted ${aiLimits.brandKitDraftsPerDay} brand kits from a website today. Try again tomorrow, or fill one in yourself.`,
    })

    const draft = await draftKitFromUrl(parsed.data.url)
    const { id } = await service.createBrandKit(workspace.id, draft.fields)

    // A missing logo never fails the kit; the user can upload one.
    const logo = await fetchLogo(draft.logoUrls)
    if (logo) {
      await storeLogo(workspace.id, id, logo).catch((error: unknown) =>
        console.warn("Couldn't store the site's logo", error)
      )
    }

    refreshKits()
    return ok({ kitId: id, isComplete: draft.isComplete })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/** Creates an empty kit for the address, without reading the site. */
export async function createBrandKitManually(
  url: unknown
): Promise<Result<{ kitId: string }>> {
  try {
    const parsed = createFromUrlSchema.safeParse({ url })
    if (!parsed.success) throw invalid(parsed.error, "Check the address.")

    const { workspace } = await requireWorkspaceAccess("content:create")
    const { id } = await service.createBrandKit(
      workspace.id,
      blankFields(parsed.data.url)
    )

    refreshKits()
    return ok({ kitId: id })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/** Saves every field of the kit editor. */
export async function saveBrandKit(
  input: unknown
): Promise<Result<{ kitId: string }>> {
  try {
    const parsed = saveBrandKitSchema.safeParse(input)
    if (!parsed.success) {
      throw invalid(
        parsed.error,
        "Some fields need a fix before saving.",
        "fields"
      )
    }

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.updateBrandKit(
      workspace.id,
      parsed.data.kitId,
      parsed.data.fields
    )

    refreshKits()
    return ok({ kitId: parsed.data.kitId })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

const logoTooBig = `Your logo is larger than ${logoRules.maxBytes / 1024 / 1024} MB. Export a smaller PNG, JPEG or WebP.`
const logoWrongType =
  "That file isn’t a PNG, JPEG or WebP image. Export your logo in one of those formats."

/** Replaces the kit's logo with an uploaded PNG, JPEG or WebP (max 2 MB). */
export async function uploadBrandKitLogo(
  formData: FormData
): Promise<Result<null>> {
  try {
    const kitId = kitIdSchema.safeParse(formData.get("kitId"))
    const file = formData.get("logo")
    if (!kitId.success || !(file instanceof File) || file.size === 0) {
      throw new AppError("VALIDATION", "Choose an image to upload.")
    }
    if (file.size > logoRules.maxBytes) {
      throw new AppError("VALIDATION", logoTooBig)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    // Trust the file's bytes, not its name or declared type.
    const type = sniffLogoType(bytes)
    if (!type) throw new AppError("VALIDATION", logoWrongType)

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await storeLogo(workspace.id, kitId.data, { bytes, type })

    refreshKits()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function removeBrandKitLogo(
  kitId: unknown
): Promise<Result<null>> {
  try {
    const parsed = kitIdSchema.safeParse(kitId)
    if (!parsed.success) throw new AppError("NOT_FOUND", "Brand kit not found.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    const { previousLogoKey } = await service.setBrandKitLogo(
      workspace.id,
      parsed.data,
      null
    )
    await deleteOldLogo(previousLogoKey)

    refreshKits()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function deleteBrandKit(kitId: unknown): Promise<Result<null>> {
  try {
    const parsed = kitIdSchema.safeParse(kitId)
    if (!parsed.success) throw new AppError("NOT_FOUND", "Brand kit not found.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.deleteBrandKit(workspace.id, parsed.data)
    // Everything the kit stored (logo, footage) lives under its folder.
    const folder = `${workspaceFileKey(workspace.id, "brand-kits", parsed.data)}/`
    await deleteFolder(folder).catch((error: unknown) =>
      console.warn("Couldn't delete brand kit files", folder, error)
    )

    refreshKits()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}
