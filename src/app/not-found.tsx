import { CompassIcon } from "lucide-react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import { LinkButton } from "@/shared/ui/link-button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            This page doesn’t exist or has moved. Check the address, or head
            back to your dashboard.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <LinkButton href="/dashboard">Go to dashboard</LinkButton>
        </EmptyContent>
      </Empty>
    </main>
  )
}
