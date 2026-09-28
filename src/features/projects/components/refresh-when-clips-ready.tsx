"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { projectClipStatuses } from "../actions"

/**
 * While a video's clip is processing, checks every few seconds (a small
 * status read) and refreshes the page once something changed — not the
 * whole page every time, which re-sent everything (and made the browser
 * warn about re-announced stylesheets).
 */
export function RefreshWhenClipsReady({
  projectId,
  statuses,
}: {
  projectId: string
  /** The statuses the page was rendered with. */
  statuses: string[]
}) {
  const router = useRouter()
  const key = statuses.join(",")
  const working = statuses.some((s) => s === "UPLOADING" || s === "PROCESSING")
  useEffect(() => {
    if (!working) return
    let stopped = false
    const timer = setInterval(async () => {
      const result = await projectClipStatuses({ projectId })
      if (stopped || !result.ok) return
      if (result.data.statuses.join(",") !== key) {
        stopped = true
        clearInterval(timer)
        router.refresh()
      }
    }, 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [projectId, key, working, router])
  return null
}
