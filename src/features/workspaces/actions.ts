"use server"

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import { AppError } from "@/shared/lib/errors"
import { err, ok, toResultError, type Result } from "@/shared/lib/result"

import { requireWorkspaceAccess } from "./queries"
import { renameWorkspaceSchema } from "./schema"
import { renameWorkspace as renameWorkspaceService } from "./service"

/**
 * The server action pattern (build plan §5.1, §13):
 * validate → authorize → service → revalidate, returning a Result.
 * Never throws to the client, except Next's own redirects.
 */
export async function renameWorkspace(
  _previous: Result<{ name: string }> | null,
  formData: FormData
): Promise<Result<{ name: string }>> {
  try {
    const parsed = renameWorkspaceSchema.safeParse({
      name: formData.get("name"),
    })
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Check the workspace name.", {
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      })
    }

    const { workspace } = await requireWorkspaceAccess("workspace:manage")
    const renamed = await renameWorkspaceService(workspace.id, parsed.data.name)

    // The name shows in the app layout (Part F), so refresh everything.
    revalidatePath("/", "layout")
    return ok({ name: renamed.name })
  } catch (error) {
    // Let Next's redirect (signed out) and not-found signals through.
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}
