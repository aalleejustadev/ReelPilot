"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import { AppError } from "@/shared/lib/errors"
import { err, ok, toResultError, type Result } from "@/shared/lib/result"

import { auth } from "./lib/auth"
import { requireUser } from "./queries"
import { updateProfileSchema } from "./schema"

/** Same pattern as workspaces/actions.ts: validate → authorize → service → revalidate. */
export async function updateProfile(
  _previous: Result<{ name: string }> | null,
  formData: FormData
): Promise<Result<{ name: string }>> {
  try {
    const parsed = updateProfileSchema.safeParse({ name: formData.get("name") })
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Check your name.", {
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      })
    }

    await requireUser()
    // Better Auth updates the user and refreshes the session cookie cache
    // (nextCookies lets it set cookies from a server action).
    await auth.api.updateUser({
      body: { name: parsed.data.name },
      headers: await headers(),
    })

    // The name shows in the sidebar on every app page.
    revalidatePath("/", "layout")
    return ok({ name: parsed.data.name })
  } catch (error) {
    unstable_rethrow(error)
    return err(toResultError(error))
  }
}
