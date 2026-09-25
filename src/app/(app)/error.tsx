"use client"

import { CircleAlertIcon, RotateCwIcon } from "lucide-react"
import { useEffect, useTransition } from "react"

import { Button } from "@/shared/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import { Spinner } from "@/shared/ui/spinner"

// Next 16: retry() re-fetches and re-renders the segment (preferred over reset).
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Empty className="flex-1 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>This page didn’t load</EmptyTitle>
        <EmptyDescription>
          Something went wrong on our side. Try again, and if it keeps
          happening, come back in a few minutes.
          {error.digest && (
            <span className="mt-2 block font-mono text-xs">
              Reference: {error.digest}
            </span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button disabled={isPending} onClick={() => startTransition(retry)}>
          {isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
