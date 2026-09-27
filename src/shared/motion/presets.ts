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
  "sway-left",
  "sway-right",
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
  "isometric-right",
  // Stylised
  "tilted-card",
  "dutch",
  "dramatic",
] as const
export type ShotPresetName = (typeof shotPresetNames)[number]

export const shotPresetGroups: { label: string; presets: ShotPresetName[] }[] =
  [
    {
      label: "Classic",
      presets: [
        "flat",
        "push-in",
        "spotlight",
        "float",
        "sway-left",
        "sway-right",
      ],
    },
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
      presets: [
        "low-angle",
        "hero-rise",
        "top-down",
        "birds-eye",
        "isometric",
        "isometric-right",
      ],
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
  // A gentle lean for slow, cinematic pushes.
  "sway-left": {
    label: "Sway left",
    camera: { ...flatCamera, turn: 6, tilt: 4 },
  },
  "sway-right": {
    label: "Sway right",
    camera: { ...flatCamera, turn: -6, tilt: 4 },
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
  "isometric-right": {
    label: "Isometric right",
    camera: { ...flatCamera, tilt: 40, turn: 28, roll: -14, zoom: 1.1 },
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
  animatedBackground: false,
  // Owner-chosen defaults (2026-09-27): 2% corners, 2% space, shadow.
  frame: { radius: 2, shadow: true, padding: 0.02 },
  intro: { kind: "none", durationMs: 1200 },
  motionBlur: true,
  edit: { parts: [] },
  textStyle: { animation: "word-rise" },
  texts: [],
  graphics: [],
  lens: {
    depthOfField: { enabled: false, fStop: 2.8, maxBlur: 1.2 },
    progressiveBlur: {
      enabled: false,
      from: "bottom",
      strength: 0.8,
      reach: 0.3,
    },
  },
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

const angles = ["tilt", "turn", "roll"] as const

/** The same shot seen from the other side (turns and rolls reversed). */
export function mirrorCamera(camera: CameraSettings): CameraSettings {
  return {
    ...camera,
    turn: camera.turn === 0 ? 0 : -camera.turn,
    roll: camera.roll === 0 ? 0 : -camera.roll,
    focusX: Math.round((1 - camera.focusX) * 1000) / 1000,
  }
}

/**
 * A shot's name: "Tilt left"; a preset aimed closer, "Tilt left · 1.8×";
 * a flat zoom, "Zoom 1.8×"; anything else hand-tuned, "Custom". Focus
 * points don't change the name.
 */
export function shotLabel(camera: CameraSettings) {
  const preset = presetOf(camera)
  if (preset) return shotPresets[preset].label
  const zoom = `${camera.zoom.toFixed(1)}×`
  if (angles.every((key) => Math.abs(camera[key]) < 0.001)) {
    return camera.zoom > 1.001 ? `Zoom ${zoom}` : shotPresets.flat.label
  }
  const similar = shotPresetNames.find((name) =>
    angles.every(
      (key) => Math.abs(shotPresets[name].camera[key] - camera[key]) < 0.001
    )
  )
  if (!similar) {
    const mirrored = presetOf(mirrorCamera(camera))
    return mirrored ? `${shotPresets[mirrored].label} · mirrored` : "Custom"
  }
  const { label, camera: base } = shotPresets[similar]
  return Math.abs(base.zoom - camera.zoom) < 0.001
    ? label
    : `${label} · ${zoom}`
}
