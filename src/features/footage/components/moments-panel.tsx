"use client"

import {
  MoveHorizontalIcon,
  RefreshCwIcon,
  ScanSearchIcon,
  SparklesIcon,
  TrashIcon,
  VideoIcon,
} from "lucide-react"
import { useState, useTransition } from "react"

import { cn } from "@/shared/lib/utils"
import {
  defaultShot,
  presetOf,
  shotLabel,
  shotPresetNames,
  shotPresets,
  type Shot,
  type ShotPresetName,
} from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

import {
  analyzeFootageAgain,
  deleteFootageMarker,
  updateFootageMarker,
} from "../actions"
import { formatTimecode } from "../lib/format"
import { parseStoredInsight } from "../lib/insight"
import type { FootageDetail } from "../queries"
import { footageLimits } from "../schema"
import { PanelHeading } from "./editor-panels"

type Marker = FootageDetail["markers"][number]

/** Where the thumbnail strip is, to show each moment's frame. */
export type ThumbnailStrip = {
  url: string | null
  count: number | null
  intervalMs: number | null
}

/** Every key moment as a card: its frame, time, shot and description. */
export function MomentsPanel({
  footageId,
  analysisStatus,
  markers,
  selectedId,
  readOnly,
  strip,
  playheadMs,
  shotOf,
  onSelect,
  onShotChange,
  onMove,
}: {
  footageId: string
  analysisStatus: FootageDetail["analysisStatus"]
  markers: Marker[]
  selectedId: string | null
  readOnly: boolean
  strip: ThumbnailStrip
  playheadMs: number
  shotOf: (marker: Marker) => Shot | null
  onSelect: (marker: Marker) => void
  onShotChange: (marker: Marker, shot: Shot | null) => void
  onMove: (marker: Marker, atMs: number) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        title="Key moments"
        description="The beats your ad cuts to. The camera moves at each one. Drag them on the timeline to change when they happen."
      />
      <AnalysisStatus
        footageId={footageId}
        status={analysisStatus}
        described={
          markers.filter((marker) => parseStoredInsight(marker.insight)).length
        }
        total={markers.length}
        readOnly={readOnly}
      />
      {markers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No key moments yet. Play the clip and press “Add marker” where
          something happens.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Key moments">
          {markers.map((marker) => (
            <MomentCard
              // A label the AI filled in after load shows up in the field.
              key={`${marker.id}:${marker.label ?? ""}`}
              marker={marker}
              readOnly={readOnly}
              isSelected={marker.id === selectedId}
              strip={strip}
              playheadMs={playheadMs}
              shot={shotOf(marker)}
              onSelect={() => onSelect(marker)}
              onShotChange={(shot) => onShotChange(marker, shot)}
              onMove={(atMs) => onMove(marker, atMs)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Where the smart analysis is (§7.4b), and a way to run it again (or for
 * the first time, on clips from before it existed).
 */
function AnalysisStatus({
  footageId,
  status,
  described,
  total,
  readOnly,
}: {
  footageId: string
  status: FootageDetail["analysisStatus"]
  described: number
  total: number
  readOnly: boolean
}) {
  const [isStarting, startAnalysis] = useTransition()
  const isWorking = status === "PENDING" || status === "RUNNING"

  function analyze() {
    startAnalysis(async () => {
      const result = await analyzeFootageAgain(footageId)
      if (!result.ok) toast.add({ type: "error", title: result.error.message })
    })
  }

  const message = isWorking
    ? "Analysing your footage: finding where the action is and reading each moment…"
    : status === "READY"
      ? total > 0 && described > 0
        ? `Analysed. The AI described ${described} of ${total} ${total === 1 ? "moment" : "moments"}.`
        : "Analysed: the camera can aim at where things happen."
      : status === "FAILED"
        ? "We couldn’t analyse this clip. Try again."
        : "Not analysed yet. Analysing finds where the action is, the footage’s colours, and what’s on screen at each moment."

  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3"
      role="status"
    >
      {isWorking ? (
        <Spinner className="mt-0.5 shrink-0" />
      ) : (
        <ScanSearchIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm">{message}</p>
        {!readOnly && !isWorking && (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isStarting}
              onClick={analyze}
            >
              {isStarting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {status === null ? "Analyse footage" : "Analyse again"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The moment's frame, cut from the timeline's thumbnail strip. */
function MomentFrame({ strip, atMs }: { strip: ThumbnailStrip; atMs: number }) {
  if (!strip.url || !strip.count || !strip.intervalMs) {
    return <span aria-hidden className="block h-9 w-16 rounded-md bg-muted" />
  }
  const index = Math.min(strip.count - 1, Math.floor(atMs / strip.intervalMs))
  const position = strip.count > 1 ? (index / (strip.count - 1)) * 100 : 0
  return (
    <span
      aria-hidden
      className="block h-9 w-16 shrink-0 rounded-md border bg-muted bg-no-repeat"
      style={{
        // Quoted: signed links contain characters CSS url() would misread.
        backgroundImage: `url("${strip.url}")`,
        backgroundSize: `${strip.count * 100}% 100%`,
        backgroundPosition: `${position}% 0`,
      }}
    />
  )
}

function MomentCard({
  marker,
  readOnly,
  isSelected,
  strip,
  playheadMs,
  shot,
  onSelect,
  onShotChange,
  onMove,
}: {
  marker: Marker
  readOnly: boolean
  isSelected: boolean
  strip: ThumbnailStrip
  playheadMs: number
  shot: Shot | null
  onSelect: () => void
  onShotChange: (shot: Shot | null) => void
  onMove: (atMs: number) => void
}) {
  const [label, setLabel] = useState(marker.label ?? "")
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const time = formatTimecode(marker.atMs)
  const labelId = `moment-${marker.id}-label`
  const insight = parseStoredInsight(marker.insight)
  const labelFromAi =
    insight !== null &&
    label !== "" &&
    label === insight.description.slice(0, footageLimits.label)

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
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background p-3 transition-shadow",
        isSelected && "border-ring ring-2 ring-ring/25"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Select the moment at ${time}`}
          aria-pressed={isSelected}
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MomentFrame strip={strip} atMs={marker.atMs} />
          <span className="flex min-w-0 flex-col">
            <span className="font-mono text-sm font-medium">{time}</span>
            <span className="truncate text-xs text-muted-foreground">
              {marker.source === "AUTO" ? "Auto-detected" : "Added by you"}
            </span>
          </span>
        </button>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move the moment at ${time} to the playhead`}
                    disabled={Math.abs(playheadMs - marker.atMs) < 50}
                    onClick={() => onMove(playheadMs)}
                  />
                }
              >
                <MoveHorizontalIcon />
              </TooltipTrigger>
              <TooltipContent>
                Move to playhead ({formatTimecode(playheadMs)})
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove marker at ${time}`}
                    disabled={isDeleting}
                    onClick={remove}
                  />
                }
              >
                {isDeleting ? <Spinner /> : <TrashIcon />}
              </TooltipTrigger>
              <TooltipContent>Remove</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <ShotSelect
        time={time}
        shot={shot}
        disabled={readOnly}
        onChange={onShotChange}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={labelId} className="text-xs font-medium">
          What’s on screen
        </label>
        <Input
          id={labelId}
          aria-label={`What’s on screen at ${time}`}
          aria-describedby={`${labelId}-hint`}
          placeholder="e.g. Opens the invoice dashboard"
          value={label}
          maxLength={footageLimits.label}
          disabled={readOnly || isSaving}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={saveLabel}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <p id={`${labelId}-hint`} className="text-xs text-muted-foreground">
          {labelFromAi
            ? "Filled in by the AI from the screen. Edit it if it’s off: it aims the camera and shapes the lines written for this moment."
            : "The AI uses this to aim the camera and to write lines that match this moment."}
        </p>
      </div>

      {insight?.headline && (
        <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SparklesIcon aria-hidden className="size-3.5" />
            Headline idea
          </span>
          <p className="text-sm">{insight.headline}</p>
        </div>
      )}
    </li>
  )
}

const keepPrevious = "keep"
const customShot = "custom"

/** A moment's shot: keep the previous one, or pick one. */
function ShotSelect({
  time,
  shot,
  disabled,
  onChange,
}: {
  time: string
  shot: Shot | null
  disabled: boolean
  onChange: (shot: Shot | null) => void
}) {
  const value = shot ? (presetOf(shot.camera) ?? customShot) : keepPrevious
  const items = [
    { value: keepPrevious, label: "Keep previous shot" },
    ...shotPresetNames.map((name) => ({
      value: name,
      label: shotPresets[name].label,
    })),
    ...(value === customShot && shot
      ? [{ value: customShot, label: shotLabel(shot.camera) }]
      : []),
  ]
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (!next || next === customShot) return
        if (next === keepPrevious) return onChange(null)
        const preset = shotPresets[next as ShotPresetName]
        onChange({ ...(shot ?? defaultShot), camera: preset.camera })
      }}
    >
      <SelectTrigger aria-label={`Camera shot at ${time}`} className="w-full">
        <VideoIcon data-icon="inline-start" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
