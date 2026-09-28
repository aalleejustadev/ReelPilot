import { workspaceFileKey } from "@/shared/storage/keys"

/**
 * An export's MP4 sits in its clip's or video's folder, so deleting the
 * clip (its folder), the video (projects' folder) or the brand kit takes
 * the file with it.
 */
export function exportFileKey(
  workspaceId: string,
  kitId: string,
  target: { kind: "clip" | "video"; id: string },
  exportId: string
) {
  return workspaceFileKey(
    workspaceId,
    "brand-kits",
    kitId,
    target.kind === "clip" ? "footage" : "projects",
    target.id,
    "exports",
    `${exportId}.mp4`
  )
}
