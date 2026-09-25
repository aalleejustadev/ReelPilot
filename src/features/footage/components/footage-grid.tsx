import { AlertCircleIcon, FilmIcon, MonitorIcon } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/shared/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Spinner } from "@/shared/ui/spinner"

import { formatDuration } from "../lib/format"
import type { FootageListItem } from "../queries"

export type FootageCard = FootageListItem & { posterUrl: string | null }

const statusLabel = {
  UPLOADING: "Uploading",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
} as const

function StatusBadge({ status }: { status: FootageCard["status"] }) {
  if (status === "READY") {
    return (
      <Badge variant="outline">
        <span aria-hidden className="size-2 rounded-full bg-chroma" />
        {statusLabel[status]}
      </Badge>
    )
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">{statusLabel[status]}</Badge>
  }
  return (
    <Badge variant="secondary">
      <Spinner data-icon="inline-start" />
      {statusLabel[status]}
    </Badge>
  )
}

/** A kit's clips as cards; each opens the clip page. */
export function FootageGrid({
  clips,
  kitId,
}: {
  clips: FootageCard[]
  kitId: string
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <li key={clip.id} className="flex">
          <Card className="relative w-full gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
            <div className="flex aspect-video items-center justify-center bg-muted">
              {clip.posterUrl ? (
                // Signed, short-lived storage URL (see brand-kits LogoField).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clip.posterUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : clip.status === "FAILED" ? (
                <AlertCircleIcon
                  aria-hidden
                  className="text-muted-foreground"
                />
              ) : (
                <FilmIcon aria-hidden className="text-muted-foreground" />
              )}
            </div>
            <CardHeader className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="min-w-0 truncate">
                  {/* The link covers the whole card. */}
                  <Link
                    href={`/brand-kits/${kitId}/footage/${clip.id}`}
                    className="outline-none after:absolute after:inset-0"
                  >
                    {clip.name}
                  </Link>
                </CardTitle>
                <StatusBadge status={clip.status} />
              </div>
              <CardDescription className="flex items-center gap-2">
                {clip.source === "RECORDING" && (
                  <MonitorIcon
                    aria-label="Screen recording"
                    className="size-4"
                  />
                )}
                {clip.durationMs !== null && (
                  <span className="font-mono">
                    {formatDuration(clip.durationMs)}
                  </span>
                )}
                {clip.status === "READY" && (
                  <span>
                    {clip._count.markers} key{" "}
                    {clip._count.markers === 1 ? "moment" : "moments"}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            {clip.status === "FAILED" && clip.errorMessage && (
              <CardContent className="pt-2">
                <p className="text-sm text-destructive">{clip.errorMessage}</p>
              </CardContent>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}
