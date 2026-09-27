/** Browser helpers for in-app screen recording. */

import { recordingLimits, type RecordingInfo } from "./recording"

/** Best recording format this browser supports (MP4 first: no conversion
 *  surprises in Safari; Chrome/Edge 126+ support it too), or "" for default. */
export function pickRecordingType(
  isSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
) {
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  return candidates.find(isSupported) ?? ""
}

export function canRecordScreen() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  )
}

/** "Screen recording 25 Sep, 14:05" */
export function recordingName(date = new Date()) {
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `Screen recording ${day}, ${time}`
}

type PipWindow = Window & { document: Document }
type DocumentPip = {
  requestWindow: (options: {
    width: number
    height: number
  }) => Promise<PipWindow>
}

/** Chrome/Edge's always-on-top mini window, when available. */
export function documentPictureInPicture(): DocumentPip | null {
  const pip = (window as Window & { documentPictureInPicture?: DocumentPip })
    .documentPictureInPicture
  return pip ?? null
}

/** Gives the mini window the app's styles, fonts and theme. */
export function copyStylesInto(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement("style")
      style.textContent = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n")
      target.head.append(style)
    } catch {
      // Cross-origin sheet: link it instead.
      if (sheet.href) {
        const link = target.createElement("link")
        link.rel = "stylesheet"
        link.href = sheet.href
        target.head.append(link)
      }
    }
  }
  target.documentElement.className = document.documentElement.className
  target.body.className = "bg-background text-foreground"
}

/** A CaptureController for getDisplayMedia, where the browser has one. */
export function newCaptureController(): EventTarget | undefined {
  const Controller = (
    window as Window & { CaptureController?: new () => EventTarget }
  ).CaptureController
  return Controller ? new Controller() : undefined
}

type CapturedMouseEvent = Event & { surfaceX: number; surfaceY: number }

/** What was shared: a tab, a window or a screen. */
export function sharedSurface(
  track: MediaStreamTrack | undefined
): RecordingInfo["surface"] {
  const surface = (
    track?.getSettings() as { displaySurface?: string } | undefined
  )?.displaySurface
  return surface === "browser" || surface === "window" || surface === "monitor"
    ? surface
    : "unknown"
}

/**
 * Records the cursor over the shared surface in browsers that report it
 * (Captured Mouse Events, a Chrome proposal; feature-detected, so other
 * browsers just record nothing). `elapsedMs` is time since recording
 * started; samples before the start (the countdown) are skipped.
 */
export function trackCursor(
  controller: EventTarget | undefined,
  track: MediaStreamTrack | undefined,
  elapsedMs: () => number
) {
  const samples: RecordingInfo["cursor"] = []
  let last = -Infinity
  const onMove = (event: Event) => {
    const { surfaceX, surfaceY } = event as CapturedMouseEvent
    // -1 means the cursor left the shared surface.
    if (!(surfaceX >= 0 && surfaceY >= 0)) return
    const t = Math.round(elapsedMs())
    if (t < 0 || t - last < recordingLimits.cursorEveryMs) return
    if (samples.length >= recordingLimits.cursorSamples) return
    const { width, height } = track?.getSettings() ?? {}
    if (!width || !height) return
    // Surface coordinates are CSS pixels; the track is in device pixels.
    const scale = window.devicePixelRatio || 1
    const x = Math.min(1, (surfaceX * scale) / width)
    const y = Math.min(1, (surfaceY * scale) / height)
    samples.push([t, Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
    last = t
  }
  controller?.addEventListener("capturedmousechange", onMove)
  return {
    samples: () => samples,
    stop: () => controller?.removeEventListener("capturedmousechange", onMove),
  }
}
