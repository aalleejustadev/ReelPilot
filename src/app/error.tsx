"use client"

import { ErrorFallback } from "./_components/error-fallback"

// Errors on the home and sign-in pages (inside the root layout).
export default function RootError(props: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <ErrorFallback {...props} />
    </main>
  )
}
