import type { NextRequest } from "next/server"

import { attachment, getExportFile } from "@/features/exports"
import { requireWorkspaceAccess } from "@/features/workspaces"

/**
 * Downloads a finished export under the video's name. The MP4 streams
 * from storage through here because the bucket can't be told to send a
 * file name (it ignores response-content-disposition).
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/exports/[exportId]/download">
) {
  const { exportId } = await context.params
  const { workspace } = await requireWorkspaceAccess("workspace:view")
  const file = await getExportFile(workspace.id, exportId)
  if (!file) return new Response("Not found", { status: 404 })

  const stored = await fetch(file.url)
  if (!stored.ok || !stored.body) {
    return new Response("The file isn’t available right now.", { status: 502 })
  }
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Content-Disposition": attachment(file.fileName),
    "Cache-Control": "private, no-store",
  })
  const length = stored.headers.get("content-length")
  if (length) headers.set("Content-Length", length)
  return new Response(stored.body, { headers })
}
