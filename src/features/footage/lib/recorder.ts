/** Browser helpers for in-app screen recording. */

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
