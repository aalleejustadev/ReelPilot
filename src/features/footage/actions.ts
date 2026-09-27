"use server"

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import { getBrandKit } from "@/features/brand-kits"
import { requireWorkspaceAccess } from "@/features/workspaces"
import { aiLimits } from "@/shared/config/plans"
import { enqueue } from "@/shared/jobs"
import { AppError } from "@/shared/lib/errors"
import { err, ok, toResultError, type Result } from "@/shared/lib/result"
import type { Presentation, Shot } from "@/shared/motion"
import { consumeRateLimit } from "@/shared/rate-limit"
import { deleteFolder, fileSize, signedFileUpload } from "@/shared/storage"

import { analyzeFootageJob, processFootageJob } from "./jobs/definitions"
import { directMotion } from "./lib/direct-motion"
import { presentationFor } from "./lib/motion"
import { getFootage } from "./queries"
import {
  addMarkerSchema,
  completeUploadSchema,
  directMotionSchema,
  footageIdSchema,
  moveMarkerSchema,
  requestUploadSchema,
  updateMarkerSchema,
  updatePresentationSchema,
  updateShotSchema,
} from "./schema"
import * as service from "./service"

// Same pattern as brand-kits/actions.ts: validate → authorize → service →
// revalidate, returning a Result; only Next's redirects are rethrown.

function invalid(error: z.ZodError, message: string) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  // Show the specific reason (e.g. the wrong file type) when there's one.
  return new AppError("VALIDATION", error.issues[0]?.message ?? message, {
    fieldErrors,
  })
}

function refreshFootage(kitId?: string) {
  revalidatePath(
    kitId ? `/brand-kits/${kitId}/footage` : "/brand-kits",
    "layout"
  )
}

export type FootageUpload = {
  footageId: string
  /** Signed form POST to storage: send `fields` then the file as "file". */
  upload: { url: string; fields: Record<string, string> }
}

/**
 * Step 1 of an upload: checks the plan's limits, creates the clip and signs
 * a browser upload straight to storage, capped at the declared size.
 */
export async function requestFootageUpload(
  input: unknown
): Promise<Result<FootageUpload>> {
  try {
    const parsed = requestUploadSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the file.")

    const { workspace } = await requireWorkspaceAccess("content:create")
    const { footageId, originalKey } = await service.createFootageUpload(
      workspace.id,
      parsed.data
    )
    const upload = await signedFileUpload(originalKey, {
      maxBytes: parsed.data.sizeBytes,
      contentType: parsed.data.contentType,
      expiresInSeconds: 60 * 60,
    })

    refreshFootage(parsed.data.kitId)
    return ok({ footageId, upload })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/**
 * Step 2: the browser says the upload finished. Checks the file really
 * arrived at the declared size, then queues processing.
 */
export async function completeFootageUpload(
  input: unknown
): Promise<Result<null>> {
  try {
    const parsed = completeUploadSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the upload.")
    const { footageId, recordedMarksMs, recording } = parsed.data

    const { workspace } = await requireWorkspaceAccess("content:create")
    const clip = await service.getUploadingFootage(workspace.id, footageId)
    if (clip) {
      const size = await fileSize(clip.originalKey)
      if (size === null || size === 0 || size > clip.sizeBytes) {
        const message = "The upload didn’t finish. Upload the clip again."
        await service.failFootage(footageId, message)
        throw new AppError("VALIDATION", message)
      }
    }
    // A repeated call (clip already processing) is fine: nothing to do.
    const started = await service.startProcessing(
      workspace.id,
      footageId,
      recordedMarksMs,
      recording
    )
    if (started) {
      await enqueue(
        processFootageJob,
        { footageId },
        { singletonKey: footageId }
      )
    }

    refreshFootage()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function deleteFootage(footageId: unknown): Promise<Result<null>> {
  try {
    const parsed = footageIdSchema.safeParse(footageId)
    if (!parsed.success) throw new AppError("NOT_FOUND", "Clip not found.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    const { folder } = await service.deleteFootage(workspace.id, parsed.data)
    // The clip is gone either way; leftover files are only wasted space.
    await deleteFolder(folder).catch((error: unknown) =>
      console.warn("Couldn't delete footage files", folder, error)
    )

    refreshFootage()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function addFootageMarker(
  input: unknown
): Promise<Result<{ markerId: string }>> {
  try {
    const parsed = addMarkerSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the marker.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    const { id } = await service.addMarker(workspace.id, parsed.data)
    await queueAnalysis(workspace.id, parsed.data.footageId)

    refreshFootage()
    return ok({ markerId: id })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function updateFootageMarker(
  input: unknown
): Promise<Result<null>> {
  try {
    const parsed = updateMarkerSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the label.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.updateMarkerLabel(
      workspace.id,
      parsed.data.markerId,
      parsed.data.label
    )

    refreshFootage()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function deleteFootageMarker(
  markerId: unknown
): Promise<Result<null>> {
  try {
    const parsed = footageIdSchema.safeParse(markerId)
    if (!parsed.success) throw new AppError("NOT_FOUND", "That marker is gone.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.deleteMarker(workspace.id, parsed.data)

    refreshFootage()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function updateMarkerShot(input: unknown): Promise<Result<null>> {
  try {
    const parsed = updateShotSchema.safeParse(input)
    if (!parsed.success)
      throw invalid(parsed.error, "Check the camera settings.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.setMarkerShot(
      workspace.id,
      parsed.data.markerId,
      parsed.data.shot
    )

    // No page refresh: the editor already shows this, and nothing else
    // renders shots or style (refreshing mid-playback was wasted work).
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function updateFootagePresentation(
  input: unknown
): Promise<Result<null>> {
  try {
    const parsed = updatePresentationSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the clip’s style.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.setFootagePresentation(
      workspace.id,
      parsed.data.footageId,
      parsed.data.presentation
    )

    // No page refresh: the editor already shows this, and nothing else
    // renders shots or style (refreshing mid-playback was wasted work).
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/** "Direct with AI": turns the owner's words into shots for every marker. */
export async function directFootageMotion(input: unknown): Promise<
  Result<{
    presentation: Presentation
    shots: { markerId: string; shot: Shot }[]
  }>
> {
  try {
    const parsed = directMotionSchema.safeParse(input)
    if (!parsed.success)
      throw invalid(parsed.error, "Describe the motion you want.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    const clip = await getFootage(workspace.id, parsed.data.footageId)
    if (!clip || clip.status !== "READY" || !clip.durationMs) {
      throw new AppError("NOT_FOUND", "That clip isn’t ready yet.")
    }
    if (clip.markers.length === 0) {
      throw new AppError(
        "VALIDATION",
        "Add a key moment first: the AI directs the camera at each one."
      )
    }
    await consumeRateLimit({
      key: `motion-direction:${workspace.id}`,
      limit: aiLimits.motionDirectionsPerDay,
      windowSeconds: 24 * 60 * 60,
      message: `You’ve used AI direction ${aiLimits.motionDirectionsPerDay} times today. Adjust the shots by hand, or try again tomorrow.`,
    })

    const kit = await getBrandKit(workspace.id, clip.brandKitId)
    const direction = await directMotion({
      instruction: parsed.data.instruction,
      durationMs: clip.durationMs,
      markers: clip.markers,
      current: presentationFor(clip.presentation, kit?.colors ?? {}),
    })
    await service.applyMotionDirection(workspace.id, clip.id, direction)

    // No page refresh: the editor already shows this, and nothing else
    // renders shots or style (refreshing mid-playback was wasted work).
    return ok(direction)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function moveFootageMarker(input: unknown): Promise<Result<null>> {
  try {
    const parsed = moveMarkerSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the new time.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    const moved = await service.moveMarker(
      workspace.id,
      parsed.data.markerId,
      parsed.data.atMs
    )
    if (moved.needsInsight) await queueAnalysis(workspace.id, moved.footageId)

    refreshFootage()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/**
 * Queues the smart analysis (§7.4b), which also describes moments that
 * have no description yet. A failed enqueue is logged, not shown: the
 * stuck-analysis sweep queues it again.
 */
async function queueAnalysis(
  workspaceId: string,
  footageId: string,
  options = { redescribe: false }
) {
  if (!(await service.requestAnalysis(workspaceId, footageId, options))) {
    return false
  }
  await enqueue(
    analyzeFootageJob,
    { footageId },
    { singletonKey: footageId }
  ).catch((error: unknown) =>
    console.warn(`[footage] couldn't queue analysis for ${footageId}`, error)
  )
  return true
}

/** "Analyse again": fresh activity map, colours and moment descriptions. */
export async function analyzeFootageAgain(
  footageId: unknown
): Promise<Result<null>> {
  try {
    const parsed = footageIdSchema.safeParse(footageId)
    if (!parsed.success) throw new AppError("NOT_FOUND", "That clip is gone.")

    const { workspace } = await requireWorkspaceAccess("content:edit")
    const queued = await queueAnalysis(workspace.id, parsed.data, {
      redescribe: true,
    })
    if (!queued) throw new AppError("NOT_FOUND", "That clip isn’t ready yet.")

    refreshFootage()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}
