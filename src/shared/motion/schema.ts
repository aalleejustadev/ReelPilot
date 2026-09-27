import { z } from "zod"

/**
 * How the screen recording is shown at a moment: rotations in degrees,
 * zoom as a scale, focus as the point (0–1 of the frame) the zoom and
 * rotations pivot on, offset as a fraction of the frame.
 */
export const cameraLimits = {
  tilt: { min: -45, max: 45 }, // rotateX: + leans the top away
  turn: { min: -60, max: 60 }, // rotateY: + turns the right edge away
  roll: { min: -20, max: 20 }, // rotateZ
  zoom: { min: 1, max: 3 },
} as const

export const cameraSchema = z.object({
  tilt: z.number().min(cameraLimits.tilt.min).max(cameraLimits.tilt.max),
  turn: z.number().min(cameraLimits.turn.min).max(cameraLimits.turn.max),
  roll: z.number().min(cameraLimits.roll.min).max(cameraLimits.roll.max),
  zoom: z.number().min(cameraLimits.zoom.min).max(cameraLimits.zoom.max),
  focusX: z.number().min(0).max(1),
  focusY: z.number().min(0).max(1),
})
export type CameraSettings = z.infer<typeof cameraSchema>

export const easingNames = ["smooth", "snappy", "linear"] as const
export type EasingName = (typeof easingNames)[number]

/** A camera shot set on a marker: where the camera goes, and how. */
export const shotSchema = z.object({
  camera: cameraSchema,
  transitionMs: z.number().int().min(0).max(3000),
  easing: z.enum(easingNames),
  /**
   * Slow cinematic push while the shot holds (0 = still, 1 = strongest):
   * the camera keeps drifting in and around until the next shot. Shots
   * saved before drift existed read as 0.
   */
  drift: z.number().min(0).max(1).default(0),
})
export type Shot = z.output<typeof shotSchema>

export const introKinds = [
  "none",
  "fly-left",
  "fly-right",
  "rise",
  "zoom-out",
] as const
export type IntroKind = (typeof introKinds)[number]

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #18b26b.")
  .transform((value) => value.toLowerCase())

/** The clip's stage: background, how the frame looks, how it enters. */
export const presentationSchema = z.object({
  background: z.object({
    kind: z.enum(["solid", "gradient"]),
    from: hexColor,
    to: hexColor,
  }),
  frame: z.object({
    /** Corner radius, as a % of the frame's width. */
    radius: z.number().min(0).max(8),
    shadow: z.boolean(),
    /** Space around the frame, as a fraction of the stage (0–0.3). */
    padding: z.number().min(0).max(0.3),
  }),
  intro: z.object({
    kind: z.enum(introKinds),
    durationMs: z.number().int().min(300).max(3000),
  }),
  /**
   * A touch of blur while the camera moves fast, as a real camera shutter
   * would show. Styles saved before it existed read as on.
   */
  motionBlur: z.boolean().default(true),
})
export type Presentation = z.output<typeof presentationSchema>
