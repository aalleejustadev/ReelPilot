import { z } from "zod"

import { projectClipSchema, projectLimits } from "@/shared/motion"

const idSchema = z.string().min(1).max(64)

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the video a name.")
  .max(projectLimits.name, `Keep it under ${projectLimits.name} characters.`)

export const createProjectSchema = z.object({
  // Optional when starting a video: renamed any time.
  name: z
    .string()
    .trim()
    .max(projectLimits.name, `Keep it under ${projectLimits.name} characters.`)
    .transform((name) => name || "Untitled video"),
  kitId: idSchema,
})

export const renameProjectSchema = z.object({
  projectId: idSchema,
  name: nameSchema,
})

export const projectIdSchema = z.object({ projectId: idSchema })

/**
 * The whole clip list, in order (adding, removing, reordering and
 * transitions all save this way). `baseVersion` is the version it was
 * edited from; a stale one is refused.
 */
export const saveProjectClipsSchema = z.object({
  projectId: idSchema,
  baseVersion: z.number().int().min(0),
  clips: z
    .array(projectClipSchema)
    .max(
      projectLimits.clips,
      `A video holds up to ${projectLimits.clips} clips.`
    ),
})

export const appendClipSchema = z.object({
  projectId: idSchema,
  footageId: idSchema,
})
