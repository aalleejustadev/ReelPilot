/** Bucket declared in neon.ts. Keep the two in sync. */
export const MEDIA_BUCKET = "media"

const segmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * Object key for a workspace's file: `workspaces/<id>/<...segments>`.
 * Every file lives under its workspace prefix, so a key can never point into
 * another workspace. Segments are single path parts: no slashes or dot-dots.
 */
export function workspaceFileKey(workspaceId: string, ...segments: string[]) {
  const parts = [workspaceId, ...segments]
  if (segments.length === 0) {
    throw new Error("A file key needs at least one segment after the workspace")
  }
  for (const part of parts) {
    if (!segmentPattern.test(part) || part.includes("..")) {
      throw new Error(`Invalid storage key segment: ${JSON.stringify(part)}`)
    }
  }
  return `workspaces/${parts.join("/")}`
}

/** True when `key` belongs to `workspaceId` (check before signing or deleting). */
export function isWorkspaceFileKey(key: string, workspaceId: string) {
  return key.startsWith(`workspaces/${workspaceId}/`)
}

/**
 * Object key for a file shared by every workspace (stock presenters):
 * `shared/<...segments>`. Same segment rules as workspace keys.
 */
export function sharedFileKey(...segments: string[]) {
  if (segments.length === 0) throw new Error("A file key needs a segment")
  for (const part of segments) {
    if (!segmentPattern.test(part) || part.includes("..")) {
      throw new Error(`Invalid storage key segment: ${JSON.stringify(part)}`)
    }
  }
  return `shared/${segments.join("/")}`
}
