import { Skeleton } from "@/shared/ui/skeleton"

// Shown instantly while the editor loads: its three bands.
export default function EditorLoading() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-14 rounded-none" />
      <div className="flex flex-1 gap-4 p-4">
        <Skeleton className="hidden w-96 lg:block" />
        <Skeleton className="flex-1" />
      </div>
      <Skeleton className="h-36 rounded-none" />
    </div>
  )
}
