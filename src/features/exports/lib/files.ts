import type { ExportShape } from "../schema"

/**
 * The download's file name: "Launch video 9x16.mp4". Only characters every
 * file system accepts; never empty.
 */
export function downloadFileName(name: string, shape: ExportShape) {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\w .()-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return `${safe || "Video"} ${shape.replace(":", "x")}.mp4`
}

/** A Content-Disposition that downloads under `fileName`. */
export function attachment(fileName: string) {
  return `attachment; filename="${fileName.replace(/"/g, "")}"`
}
