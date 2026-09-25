"use client"

import { FlagIcon, TrashIcon } from "lucide-react"
import { useRef, useState, useTransition } from "react"

import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import {
  addFootageMarker,
  deleteFootageMarker,
  updateFootageMarker,
} from "../actions"
import { formatTimecode } from "../lib/format"
import type { FootageDetail } from "../queries"
import { footageLimits } from "../schema"

type Marker = FootageDetail["markers"][number]

/**
 * Player, thumbnail timeline with markers, and the key-moments list.
 * Markers are saved as they change; the page re-renders from the server.
 */
export function ClipEditor({
  clip,
  videoUrl,
  posterUrl,
  thumbnailsUrl,
  readOnly,
}: {
  clip: FootageDetail
  videoUrl: string
  posterUrl: string | null
  thumbnailsUrl: string | null
  readOnly: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentMs, setCurrentMs] = useState(0)
  const [isAdding, startAdd] = useTransition()
  const durationMs = clip.durationMs ?? 1
  // The strip covers count × interval ms, which can run past the clip's end.
  const stripWidth =
    clip.thumbnailCount && clip.thumbnailIntervalMs
      ? (clip.thumbnailCount * clip.thumbnailIntervalMs * 100) / durationMs
      : 100

  function seek(ms: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = ms / 1000
    setCurrentMs(ms)
  }

  function addAtCurrentTime() {
    const atMs = Math.round((videoRef.current?.currentTime ?? 0) * 1000)
    startAdd(async () => {
      const result = await addFootageMarker({ footageId: clip.id, atMs })
      toast.add(
        result.ok
          ? {
              type: "success",
              title: `Marker added at ${formatTimecode(atMs)}`,
            }
          : { type: "error", title: result.error.message }
      )
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-lg bg-projector">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="mx-auto max-h-[60vh] w-full"
          onTimeUpdate={(event) =>
            setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))
          }
        >
          Your browser can’t play this video.
        </video>
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="relative h-16 cursor-pointer overflow-hidden rounded-md border bg-muted"
          role="group"
          aria-label="Timeline"
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect()
            seek(
              Math.round(((event.clientX - box.left) / box.width) * durationMs)
            )
          }}
        >
          {thumbnailsUrl && (
            // Signed, short-lived storage URL (see brand-kits LogoField).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailsUrl}
              alt=""
              className="absolute inset-y-0 left-0 h-full max-w-none"
              style={{ width: `${stripWidth}%` }}
            />
          )}
          {clip.markers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              className="group absolute inset-y-0 -ml-2.5 flex w-5 justify-center outline-none"
              // Kept just inside the ends so a marker at 0:00 stays visible.
              style={{
                left: `clamp(0.375rem, ${(marker.atMs / durationMs) * 100}%, calc(100% - 0.375rem))`,
              }}
              aria-label={`Jump to ${formatTimecode(marker.atMs)}${marker.label ? `, ${marker.label}` : ""}`}
              onClick={(event) => {
                event.stopPropagation()
                seek(marker.atMs)
              }}
            >
              <span
                aria-hidden
                // A light outline keeps the bar visible over any footage.
                className={cn(
                  "h-full w-1 rounded-full bg-chroma-strong ring-2 ring-background group-hover:w-1.5 group-focus-visible:w-1.5",
                  marker.source === "MANUAL" && "bg-tally-strong"
                )}
              />
            </button>
          ))}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground ring-1 ring-background"
            style={{ left: `${(currentMs / durationMs) * 100}%` }}
          />
        </div>
        {!readOnly && (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={addAtCurrentTime}
              disabled={isAdding}
            >
              {isAdding ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FlagIcon data-icon="inline-start" />
              )}
              Add marker at{" "}
              <span className="font-mono">{formatTimecode(currentMs)}</span>
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key moments</CardTitle>
          <CardDescription>
            Scripts cut to these moments. Auto ones come from scene changes;
            label them so you know what each shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clip.markers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No key moments yet. Play the clip and add one where something
              happens.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {clip.markers.map((marker) => (
                <MarkerRow
                  key={marker.id}
                  marker={marker}
                  readOnly={readOnly}
                  onJump={() => seek(marker.atMs)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MarkerRow({
  marker,
  readOnly,
  onJump,
}: {
  marker: Marker
  readOnly: boolean
  onJump: () => void
}) {
  const [label, setLabel] = useState(marker.label ?? "")
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const time = formatTimecode(marker.atMs)

  function saveLabel() {
    if (label.trim() === (marker.label ?? "")) return
    startSave(async () => {
      const result = await updateFootageMarker({ markerId: marker.id, label })
      if (!result.ok) toast.add({ type: "error", title: result.error.message })
    })
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteFootageMarker(marker.id)
      toast.add(
        result.ok
          ? { type: "success", title: `Marker at ${time} removed` }
          : { type: "error", title: result.error.message }
      )
    })
  }

  return (
    // Narrow screens: time, badge and delete on one line, label below.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        type="button"
        variant="ghost"
        className="font-mono"
        aria-label={`Jump to ${time}`}
        onClick={onJump}
      >
        {time}
      </Button>
      <Input
        aria-label={`Label for ${time}`}
        placeholder="What happens here?"
        value={label}
        maxLength={footageLimits.label}
        disabled={readOnly || isSaving}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={saveLabel}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="order-last w-full sm:order-none sm:w-auto sm:flex-1"
      />
      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        <Badge variant={marker.source === "AUTO" ? "secondary" : "outline"}>
          {marker.source === "AUTO" ? "Auto" : "Manual"}
        </Badge>
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove marker at ${time}`}
            disabled={isDeleting}
            onClick={remove}
          >
            {isDeleting ? <Spinner /> : <TrashIcon />}
          </Button>
        )}
      </div>
    </li>
  )
}
