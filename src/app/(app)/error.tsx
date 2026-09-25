"use client"

import { ErrorFallback } from "../_components/error-fallback"

// Errors inside the app shell: the sidebar and top bar stay usable.
export default function AppError(props: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorFallback {...props} className="flex-1 border" />
}
