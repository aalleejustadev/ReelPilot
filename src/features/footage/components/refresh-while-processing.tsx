"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** Re-renders the page every few seconds while a clip is still working. */
export function RefreshWhileProcessing({ active }: { active: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(timer)
  }, [active, router])
  return null
}
