import { z } from "zod"

import { presentationSchema, shotSchema } from "@/shared/motion"

/** Accepted video types → file extension for the stored original. */
export const footageTypes = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const
export type FootageType = keyof typeof footageTypes

export const footageLimits = {
  name: 80,
  label: 60,
  recordedMarks: 100,
} as const

const idSchema = z.string().min(1).max(64)

/** "video/webm;codecs=vp9" (MediaRecorder) → "video/webm". */
const contentTypeSchema = z
  .string()
  .transform((value) => value.split(";")[0]?.trim().toLowerCase() ?? "")
  .pipe(
    z.enum(Object.keys(footageTypes) as [FootageType, ...FootageType[]], {
      message: "Upload an MP4, MOV or WebM video.",
    })
  )

/** "Demo take 2.MOV" → "Demo take 2"; empty names get a default. */
const footageNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\.(mp4|mov|webm|m4v)$/i, "").trim())
  .transform((value) => value.slice(0, footageLimits.name) || "Untitled clip")

export const requestUploadSchema = z.object({
  kitId: idSchema,
  name: footageNameSchema,
  sizeBytes: z.number().int().positive("That file is empty."),
  contentType: contentTypeSchema,
  source: z.enum(["UPLOAD", "RECORDING"]),
})
export type RequestUploadInput = z.infer<typeof requestUploadSchema>

export const completeUploadSchema = z.object({
  footageId: idSchema,
  /** Moments marked with "Mark moment" while recording, from the start. */
  recordedMarksMs: z
    .array(z.number().int().min(0))
    .max(footageLimits.recordedMarks)
    .default([]),
})

const labelSchema = z
  .string()
  .trim()
  .max(
    footageLimits.label,
    `Keep labels under ${footageLimits.label} characters.`
  )
  .transform((value) => value || null)

export const addMarkerSchema = z.object({
  footageId: idSchema,
  atMs: z.number().int().min(0),
  label: labelSchema.nullish().transform((value) => value ?? null),
})

export const updateMarkerSchema = z.object({
  markerId: idSchema,
  label: labelSchema,
})

export const footageIdSchema = idSchema

export const updateShotSchema = z.object({
  markerId: idSchema,
  shot: shotSchema.nullable(),
})

export const updatePresentationSchema = z.object({
  footageId: idSchema,
  presentation: presentationSchema,
})

export const directMotionSchema = z.object({
  footageId: idSchema,
  instruction: z
    .string()
    .trim()
    .min(1, "Describe the motion you want.")
    .max(500, "Keep the instruction under 500 characters."),
})

export const moveMarkerSchema = z.object({
  markerId: idSchema,
  atMs: z.number().int().min(0),
})
