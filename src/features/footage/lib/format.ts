/** 65_400 → "1:05" (clip lengths). */
export function formatDuration(ms: number) {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/** 12_400 → "0:12.4" (marker times, a tenth of a second). */
export function formatTimecode(ms: number) {
  const tenths = Math.floor(ms / 100)
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`
}

const byExtension: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
}

/**
 * The file's video type, from the browser or (when it reports none, as
 * Windows often does for .mov) from its extension. "" if not a video we take.
 */
export function videoTypeOf(file: { type: string; name?: string }) {
  const type = file.type.split(";")[0]?.trim().toLowerCase() ?? ""
  if (type) return type
  const extension = file.name?.split(".").pop()?.toLowerCase() ?? ""
  return byExtension[extension] ?? ""
}
