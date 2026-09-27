"use client"

import {
  ArrowLeftIcon,
  FlagIcon,
  FilmIcon,
  ListIcon,
  PaletteIcon,
  PauseIcon,
  PlayIcon,
  Redo2Icon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  VideoIcon,
  WandSparklesIcon,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"

import { shotLabel, type Presentation, type Shot } from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { LinkButton } from "@/shared/ui/link-button"
import { Spinner } from "@/shared/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { toast } from "@/shared/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

import {
  addFootageMarker,
  directFootageMotion,
  moveFootageMarker,
  updateFootagePresentation,
  updateMarkerShot,
} from "../actions"
import { formatDuration, formatTimecode } from "../lib/format"
import { commit, createHistory, redo, undo, type History } from "../lib/history"
import { applyLook, resetLook } from "../lib/looks"
import { parseStoredShot } from "../lib/motion"
import type { FootageDetail } from "../queries"
import { ClipTimeline } from "./clip-timeline"
import { DeleteClipButton } from "./delete-clip-button"
import {
  DirectPanel,
  EffectsPanel,
  ShotPanel,
  StylePanel,
} from "./editor-panels"
import { MomentsPanel } from "./moments-panel"
import { MotionStage, stageAspects, type StageAspect } from "./motion-stage"

type Marker = FootageDetail["markers"][number]
type Motion = { shots: Record<string, Shot | null>; presentation: Presentation }
type HistoryAction =
  | { type: "commit"; next: Motion; coalesceKey?: string }
  | { type: "undo" }
  | { type: "redo" }

function historyReducer(history: History<Motion>, action: HistoryAction) {
  if (action.type === "undo") return undo(history)
  if (action.type === "redo") return redo(history)
  return commit(history, action.next, { coalesceKey: action.coalesceKey })
}

type Tool = "effects" | "shot" | "style" | "ai" | "moments"
const tools: { id: Tool; label: string; icon: React.ComponentType }[] = [
  { id: "effects", label: "Effects", icon: WandSparklesIcon },
  { id: "shot", label: "Shot", icon: VideoIcon },
  { id: "style", label: "Style", icon: PaletteIcon },
  { id: "ai", label: "AI", icon: SparklesIcon },
  { id: "moments", label: "Moments", icon: ListIcon },
]

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform)
const noSubscribe = () => () => {}

/**
 * Starts playback, ignoring the rejection browsers raise when a pause
 * interrupts a pending play() (e.g. Play then Pause straight away).
 */
function playSafely(video: HTMLVideoElement | null) {
  video?.play().catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.error(error)
    }
  })
}

/** Typing in a field keeps the browser's own shortcuts (text undo, space). */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(
    el?.closest(
      "input, textarea, select, [contenteditable=true], [role=combobox]"
    )
  )
}

/**
 * The full-screen footage editor: tools on the left, the clip in 3D in the
 * middle, the timeline across the bottom. Camera and style edits preview
 * at once, save shortly after, and can be undone (⌘Z / Ctrl+Z).
 */
export function FootageEditor({
  clip,
  videoUrl,
  posterUrl,
  thumbnailsUrl,
  initialPresentation,
  brandColors,
  readOnly,
  kitId,
  kitName,
}: {
  clip: FootageDetail
  videoUrl: string
  posterUrl: string | null
  thumbnailsUrl: string | null
  initialPresentation: Presentation
  brandColors: string[]
  readOnly: boolean
  kitId: string
  kitName: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentMs, setCurrentMs] = useState(0)
  const [isPlaying, setPlaying] = useState(false)
  const [isAdding, startAdd] = useTransition()
  const [isDirecting, startDirect] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(
    clip.markers[0]?.id ?? null
  )
  const [tool, setTool] = useState<Tool>(readOnly ? "moments" : "effects")
  const [aspect, setAspect] = useState<StageAspect>("16:9")
  const [pickingFocus, setPickingFocus] = useState(false)
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">(
    "saved"
  )
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false
  )
  const mac = useSyncExternalStore(noSubscribe, isMac, () => true)
  const undoKey = mac ? "⌘Z" : "Ctrl+Z"
  const redoKey = mac ? "⇧⌘Z" : "Ctrl+Y"

  const [history, dispatch] = useReducer(historyReducer, undefined, () =>
    createHistory<Motion>({
      shots: Object.fromEntries(
        clip.markers.map((marker) => [marker.id, parseStoredShot(marker.shot)])
      ),
      presentation: initialPresentation,
    })
  )
  const { shots, presentation } = history.present

  // Moments moved on the timeline show at their new time at once; the
  // server copy catches up after the save.
  const [timeOverrides, setTimeOverrides] = useState<Record<string, number>>({})
  const markers = useMemo(
    () =>
      clip.markers
        .map((marker) =>
          marker.id in timeOverrides
            ? { ...marker, atMs: timeOverrides[marker.id] ?? marker.atMs }
            : marker
        )
        .sort((a, b) => a.atMs - b.atMs),
    [clip.markers, timeOverrides]
  )
  const moveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  /**
   * Moves a moment. Drags save at once (so leaving right after keeps the
   * change); rapid arrow-key nudges save once they stop.
   */
  function moveMoment(
    id: string,
    atMs: number,
    options: { nudge?: boolean } = {}
  ) {
    setTimeOverrides((overrides) => ({ ...overrides, [id]: atMs }))
    clearTimeout(moveTimers.current.get(id))
    const save = async () => {
      moveTimers.current.delete(id)
      setSaveState("saving")
      const result = await moveFootageMarker({ markerId: id, atMs })
      setSaveState(result.ok ? "saved" : "failed")
      if (!result.ok) {
        setTimeOverrides(({ [id]: _dropped, ...rest }) => rest)
        toast.add({ type: "error", title: result.error.message })
      }
    }
    if (options.nudge) {
      setSaveState("saving")
      moveTimers.current.set(id, setTimeout(save, 400))
    } else {
      void save()
    }
  }

  const durationMs = clip.durationMs ?? 1
  // The strip covers count × interval ms, which can run past the clip's end.
  const stripWidth =
    clip.thumbnailCount && clip.thumbnailIntervalMs
      ? (clip.thumbnailCount * clip.thumbnailIntervalMs * 100) / durationMs
      : 100

  // Moments added after the page loaded aren't in history yet: use the
  // server's copy for them.
  const shotOf = useCallback(
    (marker: Marker) =>
      marker.id in shots
        ? (shots[marker.id] ?? null)
        : parseStoredShot(marker.shot),
    [shots]
  )
  const timedShots = useMemo(
    () =>
      markers.flatMap((marker) => {
        const shot = shotOf(marker)
        return shot ? [{ atMs: marker.atMs, shot }] : []
      }),
    [markers, shotOf]
  )
  const selected = markers.find((marker) => marker.id === selectedId) ?? null

  const onTimeChange = useCallback((ms: number) => setCurrentMs(ms), [])
  const onPlayingChange = useCallback(
    (playing: boolean) => setPlaying(playing),
    []
  )

  /** Saves after 500ms without further changes to the same thing. */
  const saveSoon = useCallback(
    (key: string, save: () => Promise<{ ok: boolean }>) => {
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
    },
    []
  )

  /** Saves whatever differs between two motion states. */
  const saveDifferences = useCallback(
    (from: Motion, to: Motion) => {
      const ids = new Set([
        ...Object.keys(from.shots),
        ...Object.keys(to.shots),
      ])
      for (const markerId of ids) {
        const next = to.shots[markerId] ?? null
        if (
          JSON.stringify(from.shots[markerId] ?? null) !== JSON.stringify(next)
        ) {
          saveSoon(`shot:${markerId}`, () =>
            updateMarkerShot({ markerId, shot: next })
          )
        }
      }
      if (
        JSON.stringify(from.presentation) !== JSON.stringify(to.presentation)
      ) {
        saveSoon("presentation", () =>
          updateFootagePresentation({
            footageId: clip.id,
            presentation: to.presentation,
          })
        )
      }
    },
    [clip.id, saveSoon]
  )

  function change(next: Motion, coalesceKey?: string) {
    saveDifferences(history.present, next)
    dispatch({ type: "commit", next, coalesceKey })
  }

  const stepHistory = useCallback(
    (direction: "undo" | "redo") => {
      const target =
        direction === "undo" ? history.past.at(-1) : history.future[0]
      if (!target) return
      saveDifferences(history.present, target)
      dispatch({ type: direction })
    },
    [history, saveDifferences]
  )

  function seek(ms: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = ms / 1000
    setCurrentMs(ms)
  }

  /** Paused: show where the camera lands, not the start of the move. */
  function showLanded(marker: Marker, shot: Shot | null) {
    const video = videoRef.current
    if (video && !video.paused) return
    seek(Math.min(durationMs, marker.atMs + (shot?.transitionMs ?? 0)))
  }

  function changeShotFor(marker: Marker, shot: Shot | null, control = "shot") {
    change(
      { shots: { ...shots, [marker.id]: shot }, presentation },
      `shot:${marker.id}:${control}`
    )
    showLanded(marker, shot)
  }

  function changePresentation(next: Presentation, control = "style") {
    change({ shots, presentation: next }, `style:${control}`)
  }

  function selectMarker(marker: Marker) {
    setSelectedId(marker.id)
    setPickingFocus(false)
    showLanded(marker, shotOf(marker))
  }

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    // At the end, Play starts again from the beginning.
    if (video.ended || video.currentTime * 1000 >= durationMs - 50) {
      video.currentTime = 0
    }
    if (video.paused) playSafely(video)
    else video.pause()
  }, [durationMs])

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
      playSafely(video)
    }
  }

  // Leaving while a save is in flight would lose it: ask first.
  useEffect(() => {
    if (saveState !== "saving") return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saveState])

  // ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo, Space play/pause.
  useEffect(() => {
    if (readOnly) return
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && key === "z") {
        event.preventDefault()
        stepHistory(event.shiftKey ? "redo" : "undo")
      } else if (mod && key === "y") {
        event.preventDefault()
        stepHistory("redo")
      } else if (
        key === " " &&
        !(event.target as HTMLElement)?.closest("button, [role=slider]")
      ) {
        event.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [readOnly, stepHistory, togglePlay])

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

  function applyLookById(lookId: string) {
    change(applyLook(lookId, markers, history.present), "look")
    stop()
    playSafely(videoRef.current)
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
      // Saved by the action already: record it for undo, don't save again.
      dispatch({
        type: "commit",
        next: {
          presentation: result.data.presentation,
          shots: {
            ...shots,
            ...Object.fromEntries(
              result.data.shots.map(({ markerId, shot }) => [markerId, shot])
            ),
          },
        },
      })
      stop()
      playSafely(videoRef.current)
      toast.add({
        type: "success",
        title: `Camera set for ${result.data.shots.length} key ${result.data.shots.length === 1 ? "moment" : "moments"}`,
        description: `Playing it from the start. ${undoKey} undoes it.`,
      })
    })
  }

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:gap-3 sm:px-4">
        {/* Rendered here, not passed in from the server page: elements
            built by the server and handed to this client component came
            back undefined after a server-action refresh, crashing it. */}
        <LinkButton
          href={`/brand-kits/${kitId}/footage`}
          variant="ghost"
          icon={<ArrowLeftIcon />}
        >
          <span className="hidden sm:inline">Footage</span>
          <span className="sr-only sm:hidden">Back to footage</span>
        </LinkButton>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="truncate text-sm font-semibold">{clip.name}</h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {kitName}
            {clip.durationMs !== null &&
              ` · ${formatDuration(clip.durationMs)}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {!readOnly && (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Undo (${undoKey})`}
                      disabled={!canUndo}
                      onClick={() => stepHistory("undo")}
                    />
                  }
                >
                  <Undo2Icon />
                </TooltipTrigger>
                <TooltipContent>Undo ({undoKey})</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Redo (${redoKey})`}
                      disabled={!canRedo}
                      onClick={() => stepHistory("redo")}
                    />
                  }
                >
                  <Redo2Icon />
                </TooltipTrigger>
                <TooltipContent>Redo ({redoKey})</TooltipContent>
              </Tooltip>
              <span
                className="text-xs whitespace-nowrap text-muted-foreground sm:w-16"
                aria-live="polite"
              >
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "failed"
                    ? "Not saved"
                    : "Saved"}
              </span>
            </>
          )}
          {!readOnly && (
            <DeleteClipButton
              footageId={clip.id}
              clipName={clip.name}
              kitId={kitId}
            />
          )}
        </div>
      </header>

      {/* Narrow screens: stage, timeline, then tools (`contents` lets the
          children reorder inside the page column). */}
      <div className="contents lg:flex lg:min-h-0 lg:flex-1 lg:flex-row">
        {/* Tools: a rail of tabs and the open panel. */}
        {!readOnly && (
          <Tabs
            orientation="vertical"
            value={tool}
            onValueChange={(value) => setTool(value as Tool)}
            className="order-3 flex-col border-t bg-card lg:order-none lg:flex-row lg:gap-0 lg:border-t-0 lg:border-r"
          >
            <TabsList
              aria-label="Editor tools"
              className="w-full shrink-0 flex-row! justify-start gap-1 overflow-x-auto rounded-none bg-card p-2 lg:h-full! lg:w-20 lg:flex-col! lg:justify-start! lg:self-stretch lg:border-r"
            >
              {tools.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="h-auto! flex-none! flex-col! gap-1 px-2 py-2 text-xs lg:w-full lg:justify-center!"
                >
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="w-full overflow-y-auto p-4 lg:w-80">
              <TabsContent value="effects">
                <EffectsPanel
                  hasMoments={markers.length > 0}
                  brandColors={brandColors}
                  onApplyLook={applyLookById}
                  onReset={() =>
                    change(resetLook(markers, presentation), "reset")
                  }
                  onBackground={(background) =>
                    changePresentation(
                      { ...presentation, background },
                      "background-preset"
                    )
                  }
                />
              </TabsContent>
              <TabsContent value="shot">
                <ShotPanel
                  moment={selected}
                  shot={selected ? shotOf(selected) : null}
                  pickingFocus={pickingFocus}
                  onShotChange={(shot, control) =>
                    selected && changeShotFor(selected, shot, control)
                  }
                  onTogglePick={() => {
                    videoRef.current?.pause()
                    setPickingFocus((picking) => !picking)
                  }}
                  onApplyToAll={() => {
                    const shot = selected ? shotOf(selected) : null
                    if (!shot) return
                    change(
                      {
                        shots: Object.fromEntries(
                          markers.map((marker) => [marker.id, shot])
                        ),
                        presentation,
                      },
                      "apply-all"
                    )
                    toast.add({
                      type: "success",
                      title: `Shot used on all ${markers.length} moments`,
                    })
                  }}
                />
              </TabsContent>
              <TabsContent value="style">
                <StylePanel
                  presentation={presentation}
                  brandColors={brandColors}
                  onChange={changePresentation}
                />
              </TabsContent>
              <TabsContent value="ai">
                <DirectPanel
                  hasMoments={markers.length > 0}
                  isDirecting={isDirecting}
                  onDirect={direct}
                />
              </TabsContent>
              <TabsContent value="moments">
                <MomentsPanel
                  markers={markers}
                  selectedId={selectedId}
                  readOnly={readOnly}
                  shotOf={shotOf}
                  strip={{
                    url: thumbnailsUrl,
                    count: clip.thumbnailCount,
                    intervalMs: clip.thumbnailIntervalMs,
                  }}
                  playheadMs={currentMs}
                  onMove={(marker, atMs) => moveMoment(marker.id, atMs)}
                  onSelect={(marker) => {
                    selectMarker(marker)
                  }}
                  onShotChange={(marker, shot) =>
                    changeShotFor(marker, shot, "select")
                  }
                />
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Stage and transport */}
        <main
          id="main-content"
          tabIndex={-1}
          className="order-1 flex min-h-0 min-w-0 flex-1 flex-col outline-none lg:order-none"
        >
          <div className="h-[50vh] bg-muted/60 p-4 sm:p-6 lg:h-auto lg:min-h-0 lg:flex-1">
            <MotionStage
              videoRef={videoRef}
              videoUrl={videoUrl}
              posterUrl={posterUrl}
              presentation={presentation}
              shots={timedShots}
              durationMs={durationMs}
              aspect={aspect}
              reduceMotion={reduceMotion}
              pickingFocus={pickingFocus}
              onPickFocus={({ x, y }) => {
                const shot = selected ? shotOf(selected) : null
                if (selected && shot) {
                  changeShotFor(
                    selected,
                    {
                      ...shot,
                      camera: { ...shot.camera, focusX: x, focusY: y },
                    },
                    "focus"
                  )
                }
                setPickingFocus(false)
              }}
              onTimeChange={onTimeChange}
              onPlayingChange={onPlayingChange}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t bg-card px-3 py-2 sm:gap-3 sm:px-4">
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
            {reduceMotion && (
              <span className="text-xs text-muted-foreground">
                Reduced motion: the preview cuts between shots.
              </span>
            )}
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
                <ToggleGroupItem
                  key={shape}
                  value={shape}
                  className="font-mono"
                >
                  {shape}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </main>
      </div>

      {/* Timeline, full width */}
      <footer className="order-2 shrink-0 border-t bg-card px-3 py-3 sm:px-4 lg:order-none">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <FilmIcon aria-hidden className="size-4" />
            Timeline
          </span>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
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
          )}
        </div>
        <ClipTimeline
          durationMs={durationMs}
          currentMs={currentMs}
          thumbnailsUrl={thumbnailsUrl}
          stripWidth={stripWidth}
          moments={markers.map((marker) => {
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
          onMoveMoment={
            readOnly
              ? undefined
              : (id, atMs, nudge) => moveMoment(id, atMs, { nudge })
          }
          onSelect={(id) => {
            const marker = markers.find((m) => m.id === id)
            if (!marker) return
            selectMarker(marker)
            if (!readOnly) setTool("shot")
          }}
        />
      </footer>
    </div>
  )
}
