"use client"

import { ErrorFallback } from "../_components/error-fallback"

export default function EditorError(props: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="flex h-dvh p-6">
      <ErrorFallback {...props} className="flex-1 border" />
    </div>
  )
}
