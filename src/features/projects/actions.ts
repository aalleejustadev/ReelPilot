"use server"

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import type { z } from "zod"

import { requireWorkspaceAccess } from "@/features/workspaces"
import { AppError } from "@/shared/lib/errors"
import { err, ok, toResultError, type Result } from "@/shared/lib/result"

import {
  createProjectSchema,
  projectIdSchema,
  renameProjectSchema,
  saveProjectClipsSchema,
} from "./schema"
import * as service from "./service"

// Same pattern as the other slices: validate → authorize → service →
// revalidate, returning a Result.

function invalid(error: z.ZodError, message: string) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return new AppError("VALIDATION", message, { fieldErrors })
}

function refreshProjects() {
  revalidatePath("/projects")
  revalidatePath("/dashboard")
}

export async function createProject(
  input: unknown
): Promise<Result<{ projectId: string }>> {
  try {
    const parsed = createProjectSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the project.")
    const { workspace } = await requireWorkspaceAccess("content:create")
    const { id } = await service.createProject(workspace.id, parsed.data)
    refreshProjects()
    return ok({ projectId: id })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function renameProject(input: unknown): Promise<Result<null>> {
  try {
    const parsed = renameProjectSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the name.")
    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.renameProject(
      workspace.id,
      parsed.data.projectId,
      parsed.data.name
    )
    refreshProjects()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

export async function deleteProject(input: unknown): Promise<Result<null>> {
  try {
    const parsed = projectIdSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the project.")
    const { workspace } = await requireWorkspaceAccess("content:edit")
    await service.deleteProject(workspace.id, parsed.data.projectId)
    refreshProjects()
    return ok(null)
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}

/**
 * Saves the clip list (order, transitions) from the version it was edited
 * from. Returns the new version; a stale one gets a CONFLICT.
 */
export async function saveProjectClips(
  input: unknown
): Promise<Result<{ version: number }>> {
  try {
    const parsed = saveProjectClipsSchema.safeParse(input)
    if (!parsed.success) throw invalid(parsed.error, "Check the clips.")
    const { workspace } = await requireWorkspaceAccess("content:edit")
    const version = await service.saveProjectClips(workspace.id, parsed.data)
    // The list and dashboard show clip counts and length; the project page
    // already shows this.
    refreshProjects()
    return ok({ version })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}
