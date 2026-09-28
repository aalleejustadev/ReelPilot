import {
  AlertCircleIcon,
  FilmIcon,
  MonitorIcon,
  UploadIcon,
} from "lucide-react"
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

/** Sits on the poster, so every variant has a solid fill. */
function StatusBadge({ status }: { status: FootageCard["status"] }) {
  if (status === "FAILED") {
    return <Badge variant="destructive">{statusLabel[status]}</Badge>
  }
  return (
    <Badge variant="secondary">
      {status === "READY" ? (
        <span aria-hidden className="size-2 rounded-full bg-chroma" />
      ) : (
        <Spinner data-icon="inline-start" />
      )}
      {statusLabel[status]}
    </Badge>
  )
}

/** "Screen recording · 0:32 · 3 key moments" */
function ClipDetails({ clip }: { clip: FootageCard }) {
  const parts: React.ReactNode[] = []
  if (clip.durationMs !== null) {
    parts.push(
      <span key="duration" className="font-mono">
        {formatDuration(clip.durationMs)}
      </span>
    )
  }
  if (clip.status === "READY") {
    const count = clip._count.markers
    parts.push(
      <span key="moments">
        {count} key {count === 1 ? "moment" : "moments"}
      </span>
    )
  } else if (clip.status !== "FAILED") {
    parts.push(<span key="working">Finding key moments…</span>)
  }

  const SourceIcon = clip.source === "RECORDING" ? MonitorIcon : UploadIcon
  return (
    <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex items-center gap-1.5">
        <SourceIcon aria-hidden className="size-4 shrink-0" />
        {clip.source === "RECORDING" ? "Screen recording" : "Upload"}
      </span>
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-2">
          <span aria-hidden>·</span>
          {part}
        </span>
      ))}
    </CardDescription>
  )
}

/** Clips as cards; each opens the clip editor. */
export function FootageGrid({
  clips,
  from,
  showKit = false,
}: {
  clips: FootageCard[]
  /** Opened from the Footage page: the editor's back link returns there. */
  from?: "footage"
  /** Clips from several kits: name each one's kit. */
  showKit?: boolean
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <li key={clip.id} className="flex">
          <Card className="relative w-full gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
            <div className="relative flex aspect-video items-center justify-center bg-muted">
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
              <div className="absolute top-3 left-3">
                <StatusBadge status={clip.status} />
              </div>
            </div>
            <CardHeader className="gap-2 pt-5">
              <CardTitle className="line-clamp-2 leading-snug break-words">
                {/* The link covers the whole card. */}
                <Link
                  href={`/brand-kits/${clip.brandKitId}/footage/${clip.id}${from ? `?from=${from}` : ""}`}
                  className="outline-none after:absolute after:inset-0"
                >
                  {clip.name}
                </Link>
              </CardTitle>
              <ClipDetails clip={clip} />
              {showKit && (
                <p className="truncate text-sm text-muted-foreground">
                  {clip.brandKit.name}
                </p>
              )}
            </CardHeader>
            {clip.status === "FAILED" && clip.errorMessage && (
              <CardContent className="pt-3">
                <p className="text-sm text-destructive">{clip.errorMessage}</p>
              </CardContent>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}
