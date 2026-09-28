"use client"

import "@/shared/styles/globals.css"

import { ErrorFallback } from "./_components/error-fallback"
import { fontSans } from "./fonts"

// Replaces the root layout when it fails, so it brings its own document,
// styles and font (Next 16 docs). No metadata export in error boundaries.

export default function GlobalError(props: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en" className={`antialiased ${fontSans.variable}`}>
      <body>
        <title>Something went wrong · ReelPilot</title>
        <main className="flex min-h-svh items-center justify-center p-6">
          <ErrorFallback {...props} />
        </main>
      </body>
    </html>
  )
}
