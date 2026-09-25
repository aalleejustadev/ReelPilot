import { Skeleton } from "@/shared/ui/skeleton"

// Shown instantly while an app page loads.
export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="min-h-64 flex-1 rounded-xl" />
    </div>
  )
}
