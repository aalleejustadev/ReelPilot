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
  // Classic
  "flat",
  "push-in",
  "spotlight",
  "float",
  // Angles
  "tilt-left",
  "tilt-right",
  "orbit-left",
  "orbit-right",
  "side-sweep-left",
  "side-sweep-right",
  // Perspective
  "low-angle",
  "hero-rise",
  "top-down",
  "birds-eye",
  "isometric",
  // Stylised
  "tilted-card",
  "dutch",
  "dramatic",
] as const
export type ShotPresetName = (typeof shotPresetNames)[number]

export const shotPresetGroups: { label: string; presets: ShotPresetName[] }[] =
  [
    { label: "Classic", presets: ["flat", "push-in", "spotlight", "float"] },
    {
      label: "Angles",
      presets: [
        "tilt-left",
        "tilt-right",
        "orbit-left",
        "orbit-right",
        "side-sweep-left",
        "side-sweep-right",
      ],
    },
    {
      label: "Perspective",
      presets: ["low-angle", "hero-rise", "top-down", "birds-eye", "isometric"],
    },
    { label: "Stylised", presets: ["tilted-card", "dutch", "dramatic"] },
  ]

export const shotPresets: Record<
  ShotPresetName,
  { label: string; camera: CameraSettings }
> = {
  flat: { label: "Flat", camera: flatCamera },
  "push-in": { label: "Push in", camera: { ...flatCamera, zoom: 1.8 } },
  spotlight: {
    label: "Spotlight",
    camera: { ...flatCamera, tilt: 8, zoom: 2.3 },
  },
  float: {
    label: "Float",
    camera: { ...flatCamera, tilt: 10, turn: -12, roll: 3, zoom: 1.02 },
  },
  "tilt-left": {
    label: "Tilt left",
    camera: { ...flatCamera, turn: 28, tilt: 8, zoom: 1.05 },
  },
  "tilt-right": {
    label: "Tilt right",
    camera: { ...flatCamera, turn: -28, tilt: 8, zoom: 1.05 },
  },
  "orbit-left": {
    label: "Orbit left",
    camera: { ...flatCamera, turn: 42, tilt: 14, zoom: 1.12 },
  },
  "orbit-right": {
    label: "Orbit right",
    camera: { ...flatCamera, turn: -42, tilt: 14, zoom: 1.12 },
  },
  "side-sweep-left": {
    label: "Side sweep left",
    camera: { ...flatCamera, turn: 54, zoom: 1.08, focusX: 0.3 },
  },
  "side-sweep-right": {
    label: "Side sweep right",
    camera: { ...flatCamera, turn: -54, zoom: 1.08, focusX: 0.7 },
  },
  "low-angle": {
    label: "Low angle",
    camera: { ...flatCamera, tilt: 30, zoom: 1.1, focusY: 0.6 },
  },
  "hero-rise": {
    label: "Hero rise",
    camera: { ...flatCamera, tilt: 40, zoom: 1.18, focusY: 0.75 },
  },
  "top-down": {
    label: "Top down",
    camera: { ...flatCamera, tilt: -25, zoom: 1.05, focusY: 0.4 },
  },
  "birds-eye": {
    label: "Bird’s-eye",
    camera: { ...flatCamera, tilt: -40, zoom: 1.12, focusY: 0.28 },
  },
  isometric: {
    label: "Isometric",
    camera: { ...flatCamera, tilt: 40, turn: -28, roll: 14, zoom: 1.1 },
  },
  "tilted-card": {
    label: "Tilted card",
    camera: { ...flatCamera, tilt: 18, turn: 20, roll: -8 },
  },
  dutch: {
    label: "Dutch angle",
    camera: { ...flatCamera, roll: -14, zoom: 1.15 },
  },
  dramatic: {
    label: "Dramatic",
    camera: { ...flatCamera, tilt: 22, turn: -34, roll: -6, zoom: 1.25 },
  },
}

export const defaultShot: Shot = {
  camera: flatCamera,
  transitionMs: 800,
  easing: "smooth",
  drift: 0,
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
