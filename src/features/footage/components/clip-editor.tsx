"use client"

import {
  FlagIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  TrashIcon,
  VideoIcon,
} from "lucide-react"
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"

import {
  defaultShot,
  presetOf,
  shotLabel,
  shotPresetNames,
  shotPresets,
  type Presentation,
  type Shot,
  type ShotPresetName,
} from "@/shared/motion"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { toast } from "@/shared/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import {
  addFootageMarker,
  deleteFootageMarker,
  directFootageMotion,
  updateFootageMarker,
  updateFootagePresentation,
  updateMarkerShot,
} from "../actions"
import { formatTimecode } from "../lib/format"
import { parseStoredShot } from "../lib/motion"
import type { FootageDetail } from "../queries"
import { footageLimits } from "../schema"
import { ClipTimeline } from "./clip-timeline"
import { MotionInspector, type InspectorTab } from "./motion-inspector"
import { MotionStage, stageAspects, type StageAspect } from "./motion-stage"

type Marker = FootageDetail["markers"][number]

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * The clip page's editor: the clip in 3D over its background, a playback
 * bar, the thumbnail timeline with markers, the key-moments list and the
 * motion inspector. Shots and style preview instantly and save shortly
 * after the last change.
 */
export function ClipEditor({
  clip,
  videoUrl,
  posterUrl,
  thumbnailsUrl,
  initialPresentation,
  brandColors,
  readOnly,
}: {
  clip: FootageDetail
  videoUrl: string
  posterUrl: string | null
  thumbnailsUrl: string | null
  initialPresentation: Presentation
  brandColors: string[]
  readOnly: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentMs, setCurrentMs] = useState(0)
  const [isPlaying, setPlaying] = useState(false)
  const [isAdding, startAdd] = useTransition()
  const [isDirecting, startDirect] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(
    clip.markers[0]?.id ?? null
  )
  const [tab, setTab] = useState<InspectorTab>("shot")
  const [aspect, setAspect] = useState<StageAspect>("16:9")
  const [pickingFocus, setPickingFocus] = useState(false)
  const [presentation, setPresentation] = useState(initialPresentation)
  // Local edits win over the server copy until the page reloads.
  const [shotEdits, setShotEdits] = useState<Record<string, Shot | null>>({})
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">(
    "saved"
  )
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false
  )

  const durationMs = clip.durationMs ?? 1
  // The strip covers count × interval ms, which can run past the clip's end.
  const stripWidth =
    clip.thumbnailCount && clip.thumbnailIntervalMs
      ? (clip.thumbnailCount * clip.thumbnailIntervalMs * 100) / durationMs
      : 100

  const shotOf = (marker: Marker) =>
    marker.id in shotEdits
      ? (shotEdits[marker.id] ?? null)
      : parseStoredShot(marker.shot)
  const timedShots = useMemo(
    () =>
      clip.markers.flatMap((marker) => {
        const shot =
          marker.id in shotEdits
            ? (shotEdits[marker.id] ?? null)
            : parseStoredShot(marker.shot)
        return shot ? [{ atMs: marker.atMs, shot }] : []
      }),
    [clip.markers, shotEdits]
  )
  const selected =
    clip.markers.find((marker) => marker.id === selectedId) ?? null

  const onTimeChange = useCallback((ms: number) => setCurrentMs(ms), [])
  const onPlayingChange = useCallback(
    (playing: boolean) => setPlaying(playing),
    []
  )

  /** Saves after 500ms without further changes to the same thing. */
  function saveSoon(key: string, save: () => Promise<{ ok: boolean }>) {
    const timers = saveTimers.current
    clearTimeout(timers.get(key))
    setSaveState("saving")
    timers.set(
      key,
      setTimeout(async () => {
        timers.delete(key)
        const result = await save()
        if (timers.size === 0) setSaveState(result.ok ? "saved" : "failed")
        if (!result.ok) {
          toast.add({
            type: "error",
            title: "We couldn’t save that change. Try again.",
          })
        }
      }, 500)
    )
  }

  /** Paused: show where the camera lands, not the start of the move. */
  function showLanded(marker: Marker, shot: Shot | null) {
    const video = videoRef.current
    if (video && !video.paused) return
    seek(Math.min(durationMs, marker.atMs + (shot?.transitionMs ?? 0)))
  }

  function changeShotFor(marker: Marker, shot: Shot | null) {
    const markerId = marker.id
    setShotEdits((edits) => ({ ...edits, [markerId]: shot }))
    showLanded(marker, shot)
    saveSoon(`shot:${markerId}`, () => updateMarkerShot({ markerId, shot }))
  }

  function changeShot(shot: Shot | null) {
    if (selected) changeShotFor(selected, shot)
  }

  function changePresentation(next: Presentation) {
    setPresentation(next)
    saveSoon("presentation", () =>
      updateFootagePresentation({ footageId: clip.id, presentation: next })
    )
  }

  function seek(ms: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = ms / 1000
    setCurrentMs(ms)
  }

  function selectMarker(marker: Marker) {
    setSelectedId(marker.id)
    setTab("shot")
    setPickingFocus(false)
    showLanded(marker, shotOf(marker))
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    // At the end, Play starts again from the beginning.
    if (video.ended || video.currentTime * 1000 >= durationMs - 50) seek(0)
    if (video.paused) void video.play()
    else video.pause()
  }

  function stop() {
    videoRef.current?.pause()
    seek(0)
  }

  // Dragging the playhead pauses playback, then resumes it if it was on.
  const resumeAfterScrub = useRef(false)
  function onScrubbingChange(scrubbing: boolean) {
    const video = videoRef.current
    if (!video) return
    if (scrubbing) {
      resumeAfterScrub.current = !video.paused
      video.pause()
    } else if (resumeAfterScrub.current) {
      void video.play()
    }
  }

  function addAtCurrentTime() {
    const atMs = Math.round((videoRef.current?.currentTime ?? 0) * 1000)
    startAdd(async () => {
      const result = await addFootageMarker({ footageId: clip.id, atMs })
      if (result.ok) setSelectedId(result.data.markerId)
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

  function direct(instruction: string) {
    startDirect(async () => {
      const result = await directFootageMotion({
        footageId: clip.id,
        instruction,
      })
      if (!result.ok) {
        toast.add({ type: "error", title: result.error.message })
        return
      }
      setPresentation(result.data.presentation)
      setShotEdits((edits) => ({
        ...edits,
        ...Object.fromEntries(
          result.data.shots.map(({ markerId, shot }) => [markerId, shot])
        ),
      }))
      setTab("shot")
      seek(0)
      void videoRef.current?.play()
      toast.add({
        type: "success",
        title: `Camera set for ${result.data.shots.length} key ${result.data.shots.length === 1 ? "moment" : "moments"}`,
        description:
          "Playing it from the start. Fine-tune any shot on the right.",
      })
    })
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <MotionStage
          videoRef={videoRef}
          videoUrl={videoUrl}
          posterUrl={posterUrl}
          presentation={presentation}
          shots={timedShots}
          aspect={aspect}
          reduceMotion={reduceMotion}
          pickingFocus={pickingFocus}
          onPickFocus={({ x, y }) => {
            const shot = selected ? shotOf(selected) : null
            if (shot)
              changeShot({
                ...shot,
                camera: { ...shot.camera, focusX: x, focusY: y },
              })
            setPickingFocus(false)
          }}
          onTimeChange={onTimeChange}
          onPlayingChange={onPlayingChange}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Stop"
            onClick={stop}
          >
            <SquareIcon />
          </Button>
          <span className="font-mono text-sm" aria-label="Playback position">
            {formatTimecode(currentMs)} / {formatTimecode(durationMs)}
          </span>
          <ToggleGroup
            aria-label="Preview shape"
            variant="outline"
            size="sm"
            className="ml-auto"
            value={[aspect]}
            onValueChange={(values) => {
              const next = values[0] as StageAspect | undefined
              if (next) setAspect(next)
            }}
          >
            {(Object.keys(stageAspects) as StageAspect[]).map((shape) => (
              <ToggleGroupItem key={shape} value={shape} className="font-mono">
                {shape}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {reduceMotion && (
          <p className="text-sm text-muted-foreground">
            Your system asks for reduced motion, so the preview cuts between
            shots. Rendered ads still move.
          </p>
        )}

        <ClipTimeline
          durationMs={durationMs}
          currentMs={currentMs}
          thumbnailsUrl={thumbnailsUrl}
          stripWidth={stripWidth}
          moments={clip.markers.map((marker) => {
            const shot = shotOf(marker)
            return {
              id: marker.id,
              atMs: marker.atMs,
              label: marker.label,
              source: marker.source,
              shotLabel: shot ? shotLabel(shot.camera) : null,
            }
          })}
          selectedId={selectedId}
          onSeek={seek}
          onScrubbingChange={onScrubbingChange}
          onSelect={(id) => {
            const marker = clip.markers.find((m) => m.id === id)
            if (marker) selectMarker(marker)
          }}
        />
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

        <Card>
          <CardHeader>
            <CardTitle>Key moments</CardTitle>
            <CardDescription>
              Scripts cut to these moments, and the camera moves at each one.
              Auto ones come from scene changes; label them so you know what
              each shows.
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
                    isSelected={marker.id === selectedId}
                    shot={shotOf(marker)}
                    onSelect={() => selectMarker(marker)}
                    onShotChange={(shot) => changeShotFor(marker, shot)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!readOnly && (
        <MotionInspector
          tab={tab}
          onTabChange={setTab}
          moment={selected}
          shot={selected ? shotOf(selected) : null}
          presentation={presentation}
          brandColors={brandColors}
          pickingFocus={pickingFocus}
          hasMoments={clip.markers.length > 0}
          isDirecting={isDirecting}
          saveState={saveState}
          onShotChange={changeShot}
          onPresentationChange={changePresentation}
          onTogglePick={() => {
            videoRef.current?.pause()
            setPickingFocus((picking) => !picking)
          }}
          onDirect={direct}
        />
      )}
    </div>
  )
}

function MarkerRow({
  marker,
  readOnly,
  isSelected,
  shot,
  onSelect,
  onShotChange,
}: {
  marker: Marker
  readOnly: boolean
  isSelected: boolean
  shot: Shot | null
  onSelect: () => void
  onShotChange: (shot: Shot | null) => void
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
        variant={isSelected ? "secondary" : "ghost"}
        className="font-mono"
        aria-label={`Select the moment at ${time}`}
        aria-pressed={isSelected}
        onClick={onSelect}
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
        <ShotSelect
          time={time}
          shot={shot}
          disabled={readOnly}
          onChange={onShotChange}
        />
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

const keepPrevious = "keep"
const customShot = "custom"

/** A moment's shot, right in its row: keep the previous one or pick one. */
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
    ...(value === customShot ? [{ value: customShot, label: "Custom" }] : []),
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
      <SelectTrigger
        size="sm"
        aria-label={`Camera shot at ${time}`}
        className="w-40"
      >
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
