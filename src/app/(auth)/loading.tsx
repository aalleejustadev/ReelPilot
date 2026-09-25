import { Card, CardContent, CardHeader } from "@/shared/ui/card"
import { Skeleton } from "@/shared/ui/skeleton"

// Matches the sign-in card's shape so the page doesn't jump when it loads.
export default function AuthLoading() {
  return (
    <Card
      aria-busy="true"
      className="[--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]"
    >
      <span className="sr-only">Loading…</span>
      <CardHeader className="items-center gap-2">
        <Skeleton className="mx-auto h-7 w-44" />
        <Skeleton className="mx-auto h-5 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="my-3 h-px" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </CardContent>
    </Card>
  )
}
