import type { CameraSettings, IntroKind, Presentation, Shot } from "./schema"

export const flatCamera: CameraSettings = {
  tilt: 0,
  turn: 0,
  roll: 0,
  zoom: 1,
  focusX: 0.5,
  focusY: 0.5,
}

export const shotPresetNames = [
  "flat",
  "tilt-left",
  "tilt-right",
  "low-angle",
  "top-down",
  "push-in",
  "dramatic",
] as const
export type ShotPresetName = (typeof shotPresetNames)[number]

export const shotPresets: Record<
  ShotPresetName,
  { label: string; camera: CameraSettings }
> = {
  flat: { label: "Flat", camera: flatCamera },
  "tilt-left": {
    label: "Tilt left",
    camera: { ...flatCamera, turn: 28, tilt: 8, zoom: 1.05 },
  },
  "tilt-right": {
    label: "Tilt right",
    camera: { ...flatCamera, turn: -28, tilt: 8, zoom: 1.05 },
  },
  "low-angle": {
    label: "Low angle",
    camera: { ...flatCamera, tilt: 30, zoom: 1.1, focusY: 0.6 },
  },
  "top-down": {
    label: "Top down",
    camera: { ...flatCamera, tilt: -25, zoom: 1.05, focusY: 0.4 },
  },
  "push-in": { label: "Push in", camera: { ...flatCamera, zoom: 1.8 } },
  dramatic: {
    label: "Dramatic",
    camera: { ...flatCamera, tilt: 22, turn: -34, roll: -6, zoom: 1.25 },
  },
}

export const defaultShot: Shot = {
  camera: flatCamera,
  transitionMs: 800,
  easing: "smooth",
}

/** A camera state for intros: may sit off-stage and smaller than flat. */
export type CameraPose = CameraSettings & { x: number; y: number }

export const introPoses: Record<Exclude<IntroKind, "none">, CameraPose> = {
  "fly-left": { ...flatCamera, turn: 55, tilt: 10, zoom: 1, x: -1.1, y: 0 },
  "fly-right": { ...flatCamera, turn: -55, tilt: 10, zoom: 1, x: 1.1, y: 0 },
  rise: { ...flatCamera, tilt: 50, zoom: 1, x: 0, y: 0.9 },
  "zoom-out": { ...flatCamera, zoom: 2.6, x: 0, y: 0 },
}

export const introLabels: Record<IntroKind, string> = {
  none: "None",
  "fly-left": "Fly in from the left",
  "fly-right": "Fly in from the right",
  rise: "Rise up",
  "zoom-out": "Zoom out",
}

export const defaultPresentation: Presentation = {
  background: { kind: "gradient", from: "#15171c", to: "#5b6170" },
  frame: { radius: 2, shadow: true, padding: 0.1 },
  intro: { kind: "none", durationMs: 1200 },
}

/** The preset a camera matches exactly, if any. */
export function presetOf(camera: CameraSettings): ShotPresetName | undefined {
  return shotPresetNames.find((name) => {
    const preset = shotPresets[name].camera
    return (Object.keys(preset) as (keyof CameraSettings)[]).every(
      (key) => Math.abs(preset[key] - camera[key]) < 0.001
    )
  })
}

/** "Tilt left", or "Custom" for hand-tuned cameras. */
export function shotLabel(camera: CameraSettings) {
  const preset = presetOf(camera)
  return preset ? shotPresets[preset].label : "Custom"
}
