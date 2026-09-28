"use server"

import { unstable_rethrow } from "next/navigation"

import { requireWorkspaceAccess } from "@/features/workspaces"
import { enqueue } from "@/shared/jobs"
import { AppError } from "@/shared/lib/errors"
import { err, ok, toResultError, type Result } from "@/shared/lib/result"
import { consumeRateLimit } from "@/shared/rate-limit"

import { renderExportJob } from "./jobs/definitions"
import { loadRenderInput } from "./lib/render-input"
import { getExportPanel, type ExportPanel } from "./queries"
import {
  exportTargetSchema,
  shareLinkSchema,
  startExportSchema,
} from "./schema"
import * as service from "./service"

// Same pattern as the other slices: validate → authorize → service,
// returning a Result. The dialog reads state back with exportPanel.

const invalid = () => new AppError("VALIDATION", "Check the export.")

/** Renders a day, per workspace: each one keeps the worker busy for minutes. */
const dailyExports = 50

/**
 * Queues an MP4 export of a clip or video in one shape, or returns the
 * one already running. Returns the dialog's new state.
 */
export async function startExport(
  input: unknown
): Promise<Result<ExportPanel>> {
  try {
    const parsed = startExportSchema.safeParse(input)
    if (!parsed.success) throw invalid()
    const { target, shape } = parsed.data
    const { workspace } = await requireWorkspaceAccess("content:edit")
    const render = await loadRenderInput(workspace.id, target, {
      linkSeconds: 60,
    })
    if (!render) {
      await service.assertTarget(workspace.id, target)
      throw invalid()
    }
    if (render.notReady) throw new AppError("VALIDATION", render.notReady)

    // A second click while one runs doesn't render twice.
    if (!(await service.findRunningExport(workspace.id, target, shape))) {
      await consumeRateLimit({
        key: `exports:${workspace.id}`,
        limit: dailyExports,
        windowSeconds: 24 * 60 * 60,
        message: `You’ve made ${dailyExports} exports today. Try again tomorrow.`,
      })
      const { id } = await service.createExport(
        workspace.id,
        target,
        shape,
        render.name
      )
      await enqueue(renderExportJob, { exportId: id }).catch(
        async (error: unknown) => {
          await service.discardExport(id)
          throw error
        }
      )
    }
    return ok((await getExportPanel(workspace.id, target))!)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/** The dialog's state: exports by shape, the share link, readiness. */
export async function exportPanel(
  input: unknown
): Promise<Result<ExportPanel>> {
  try {
    const parsed = exportTargetSchema.safeParse(input)
    if (!parsed.success) throw invalid()
    const { workspace } = await requireWorkspaceAccess("workspace:view")
    const panel = await getExportPanel(workspace.id, parsed.data)
    if (!panel) {
      await service.assertTarget(workspace.id, parsed.data)
      throw invalid()
    }
    return ok(panel)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/** Turns the public link on (creating it the first time) or off. */
export async function setShareLink(
  input: unknown
): Promise<Result<ExportPanel>> {
  try {
    const parsed = shareLinkSchema.safeParse(input)
    if (!parsed.success) throw invalid()
    const { target, enabled } = parsed.data
    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.assertTarget(workspace.id, target)
    await service.setShareLink(workspace.id, target, enabled)
    return ok((await getExportPanel(workspace.id, target))!)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}
