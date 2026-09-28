"use client"

import {
  ApertureIcon,
  ArrowLeftIcon,
  FlagIcon,
  FilmIcon,
  ListIcon,
  PaletteIcon,
  MaximizeIcon,
  PauseIcon,
  PlusIcon,
  PlayIcon,
  Redo2Icon,
  ScissorsIcon,
  ShapesIcon,
  SparklesIcon,
  SquareIcon,
  TypeIcon,
  Undo2Icon,
  VideoIcon,
  WandSparklesIcon,
} from "lucide-react"
import type { PlayerRef } from "@remotion/player"
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

import {
  joinWithPrevious,
  outputDuration,
  partsOf,
  plainText,
  shotLabel,
  splitAt,
  toOutputNearest,
  toSource,
  updatePart,
  updateRange,
  type ClipEdit,
  type Presentation,
  type Shot,
  type TextItem,
  boxAround,
  freeTrack,
  graphicInfo,
  graphicKinds,
  type GraphicKind,
  isLayoutGraphic,
  isScreenGraphic,
  type GraphicItem,
} from "@/shared/motion"
import type { StageFonts } from "@/remotion/components/TextLayer"
import { Button } from "@/shared/ui/button"
import { LinkButton } from "@/shared/ui/link-button"
import { Spinner } from "@/shared/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { useFullscreen, useSpaceToPlay } from "@/shared/hooks/use-player-keys"
import { ConflictDialog } from "@/shared/ui/conflict-dialog"
import { toast } from "@/shared/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"
import { ExportDialog } from "@/features/exports/client"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

import {
  addFootageMarker,
  directFootageEdit,
  freshFootageLinks,
  moveFootageMarker,
  suggestMomentGraphic,
  updateFootagePresentation,
  updateMarkerShot,
} from "../actions"
import { aimAt } from "../lib/aim"
import { applyPlan, planSummary } from "../lib/apply-plan"
import type { EditScope } from "../lib/direct-edit"
import { parseStoredAnalysis } from "../lib/analysis"
import { formatDuration, formatTimecode } from "../lib/format"
import {
  boxFor,
  buildTemplate,
  graphicTemplates,
  newGraphic,
  newItemId,
  templatesFor,
  type GraphicTemplateId,
} from "../lib/graphic-templates"
import { commit, createHistory, redo, undo, type History } from "../lib/history"
import { applyLook, resetLook } from "../lib/looks"
import { parseStoredInsight } from "../lib/insight"
import { parseStoredShot } from "../lib/motion"
import { stageFontsFor } from "../lib/stage-fonts"
import { parseStoredRecording } from "../lib/recording"
import type { FootageDetail } from "../queries"
import { ClipTimeline, type OverlayBlock } from "./clip-timeline"
import { CutsPanel } from "./cuts-panel"
import type { DragPayload } from "./layer-control"
import { ShortcutsDialog } from "./shortcuts-dialog"
import { GraphicsPanel } from "./graphics-panel"
import { LensPanel } from "./lens-panel"
import { TextPanel, type TextPreset } from "./text-panel"
import { DeleteClipButton } from "./delete-clip-button"
import { FullscreenControls } from "./fullscreen-controls"
import {
  TimelineResizeHandle,
  timelineMinHeight,
} from "./timeline-resize-handle"

/** Where the timeline's chosen height is kept (this browser only). */
const timelineHeightKey = "reelpilot:timeline-height"

function readTimelineHeight() {
  try {
    const saved = Number(window.localStorage.getItem(timelineHeightKey))
    return saved >= timelineMinHeight ? saved : null
  } catch {
    return null
  }
}

const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}
import {
  DirectPanel,
  EffectsPanel,
  ShotPanel,
  StylePanel,
  textSwatches,
} from "./editor-panels"
import { MomentsPanel } from "./moments-panel"
import { MotionStage, stageAspects, type StageAspect } from "./motion-stage"
import { stageFps } from "@/remotion/compositions/FootageStage"
import { err, type Result } from "@/shared/lib/result"
import { cn } from "@/shared/lib/utils"
import { RefreshWhileProcessing } from "./refresh-while-processing"

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

type Tool =
  | "effects"
  | "shot"
  | "cuts"
  | "text"
  | "graphics"
  | "lens"
  | "style"
  | "ai"
  | "moments"
const tools: { id: Tool; label: string; icon: React.ComponentType }[] = [
  // In the order a first edit usually goes: let the AI (or a look) do the
  // heavy lifting, check the moments, then refine camera, cuts, text,
  // graphics, lens and style.
  { id: "ai", label: "AI", icon: SparklesIcon },
  { id: "effects", label: "Looks", icon: WandSparklesIcon },
  { id: "moments", label: "Moments", icon: ListIcon },
  { id: "shot", label: "Camera", icon: VideoIcon },
  { id: "cuts", label: "Cuts", icon: ScissorsIcon },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "graphics", label: "Graphics", icon: ShapesIcon },
  { id: "lens", label: "Lens", icon: ApertureIcon },
  { id: "style", label: "Style", icon: PaletteIcon },
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

/** Playback through the Remotion Player (frames at the stage's fps). */
const playerTime = (player: PlayerRef | null) =>
  player ? (player.getCurrentFrame() / stageFps) * 1000 : 0

/** Where Space types a space: text fields, not buttons or sliders. */

/**
 * Signed links change on every server render (each refresh re-signs
 * them), and a new <video> src restarts playback from 0. So the first
 * links are kept, and replaced only by fresh ones from the server: before
 * they expire (they're signed for an hour), and when a video fails to
 * load. A stale link used to stall playback at the next part or magnifier,
 * whose new video element couldn't load it.
 */
type Links = {
  videoUrl: string
  posterUrl: string | null
  thumbnailsUrl: string | null
}

/** Refresh a little before the hour-long signatures run out. */
const linkLifetimeMs = 45 * 60 * 1000

function useStableLinks(footageId: string, links: Links) {
  const [stable, setStable] = useState(links)
  const signedAt = useRef(0)
  const inFlight = useRef(false)
  useEffect(() => {
    signedAt.current = Date.now()
  }, [])
  const renew = useCallback(async () => {
    // One refresh at a time, and not more than every 5s (several parts can
    // fail together).
    if (inFlight.current || Date.now() - signedAt.current < 5000) return
    inFlight.current = true
    try {
      const result = await freshFootageLinks(footageId)
      if (result.ok && result.data.videoUrl) {
        signedAt.current = Date.now()
        setStable({ ...result.data, videoUrl: result.data.videoUrl })
      }
    } finally {
      inFlight.current = false
    }
  }, [footageId])
  // Before they expire: on a timer, and when a tab comes back to view.
  useEffect(() => {
    const check = () => {
      if (Date.now() - signedAt.current > linkLifetimeMs) void renew()
    }
    const timer = setInterval(check, 60_000)
    document.addEventListener("visibilitychange", check)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
    }
  }, [renew])
  const renewNow = useCallback(() => {
    signedAt.current = 0
    void renew()
  }, [renew])
  return [stable, renewNow] as const
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
  kitFonts,
  kitLogoUrl,
  kitSite,
  backTo = null,
  video = null,
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
  /** The brand kit's fonts (names from the ad font list). */
  kitFonts: { heading?: string; body?: string }
  kitLogoUrl: string | null
  /** The kit's site, e.g. "acme.app". */
  kitSite: string
  /** Opened from a video or the Footage page: back goes there instead. */
  backTo?: { href: string; label: string } | null
  /**
   * Edited as part of a video. A one-clip video is edited right here, so
   * it's titled with the video's name; "Add clip" opens its clip list.
   * "Delete clip" is hidden (it would delete the video's recording).
   */
  video?: {
    id: string
    name: string
    single: boolean
    addClipHref: string
  } | null
}) {
  const playerRef = useRef<PlayerRef>(null)
  const [links, renewLinks] = useStableLinks(clip.id, {
    videoUrl,
    posterUrl,
    thumbnailsUrl,
  })
  const [currentMs, setCurrentMs] = useState(0)
  // Playback speed for the J/K/L shuttle (negative plays backwards).
  const [rate, setRate] = useState(1)
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
  const inFlight = useRef(0)
  // Versioned saves: the edit's saved version, and this tab's presentation
  // saves run one after another so they never race each other. A refused
  // save (changed elsewhere) stops saving and offers a reload.
  const presentationVersion = useRef(clip.presentationVersion)
  const presentationQueue = useRef<Promise<unknown>>(Promise.resolve())
  const [conflict, setConflict] = useState<"none" | "open" | "dismissed">(
    "none"
  )
  const conflicted = useRef(false)
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
  // The Player runs on the ad's time (after cuts, speed changes and
  // transitions); the timeline, moments and markers on the footage's.
  const edit = presentation.edit
  const adDurationMs = outputDuration(edit, durationMs)
  const sourceMs = toSource(edit, durationMs, currentMs)
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

  // Smart analysis (§7.4b): where the action is, idle stretches, colours.
  const analysis = useMemo(
    () => parseStoredAnalysis(clip.analysis),
    [clip.analysis]
  )
  const recording = useMemo(
    () => parseStoredRecording(clip.recording),
    [clip.recording]
  )
  const selectedAim = selected
    ? aimAt({
        analysis,
        recording,
        insight: parseStoredInsight(selected.insight),
        atMs: selected.atMs,
      })
    : null
  const idleMs = (analysis?.idle ?? []).reduce(
    (total, range) => total + range.endMs - range.startMs,
    0
  )
  const isAnalysing =
    clip.analysisStatus === "PENDING" || clip.analysisStatus === "RUNNING"

  const onTimeChange = useCallback((ms: number) => setCurrentMs(ms), [])
  const onPlayingChange = useCallback(
    (playing: boolean) => setPlaying(playing),
    []
  )

  /** Saves after 500ms without further changes to the same thing. */
  const saveSoon = useCallback(
    (key: string, save: () => Promise<Result<unknown>>) => {
      const timers = saveTimers.current
      clearTimeout(timers.get(key))
      setSaveState("saving")
      timers.set(
        key,
        setTimeout(async () => {
          timers.delete(key)
          inFlight.current++
          const result = await save()
          inFlight.current--
          // "Saved" only once nothing waits or is still on its way (a
          // reload then can't lose the last change).
          if (!result.ok) setSaveState("failed")
          else if (timers.size === 0 && inFlight.current === 0)
            setSaveState("saved")
          if (!result.ok && result.error.code === "CONFLICT") {
            if (!conflicted.current) setConflict("open")
            conflicted.current = true
          } else if (!result.ok) {
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
        saveSoon("presentation", () => {
          const run = presentationQueue.current.then(
            async (): Promise<Result<unknown>> => {
              // Once refused, nothing more saves from this stale copy.
              if (conflicted.current) {
                return err({ code: "CONFLICT", message: "Changed elsewhere" })
              }
              const result = await updateFootagePresentation({
                footageId: clip.id,
                presentation: to.presentation,
                baseVersion: presentationVersion.current,
              })
              if (result.ok) presentationVersion.current = result.data.version
              return result
            }
          )
          presentationQueue.current = run.catch(() => {})
          return run
        })
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

  /** Ad time between two footage times (a resized block's length). */
  function adLengthBetween(startMs: number, endMs: number, min: number) {
    const length =
      toOutputNearest(edit, durationMs, endMs) -
      toOutputNearest(edit, durationMs, startMs)
    return Math.round(Math.min(15_000, Math.max(min, length)))
  }

  /** Moves the playhead to a time in the ad. */
  function seekAd(adMs: number) {
    const player = playerRef.current
    if (!player) return
    player.seekTo(Math.round((adMs / 1000) * stageFps))
    setCurrentMs(adMs)
  }

  /** Moves the playhead to a time in the footage (cut parts: the next kept one). */
  function seek(footageMs: number) {
    seekAd(toOutputNearest(edit, durationMs, footageMs))
  }

  /** Paused: show where the camera lands, not the start of the move. */
  function showLanded(marker: Marker, shot: Shot | null) {
    if (playerRef.current?.isPlaying()) return
    seekAd(
      Math.min(
        adDurationMs,
        toOutputNearest(edit, durationMs, marker.atMs) +
          (shot?.transitionMs ?? 0)
      )
    )
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

  // ── Cuts, speed and transitions ──
  const clipParts = partsOf(edit, durationMs)
  const [selectedPart, setSelectedPart] = useState<number | null>(null)

  function changeEdit(next: ClipEdit, control: string) {
    if (next === edit) return false
    changePresentation({ ...presentation, edit: next }, `edit:${control}`)
    return true
  }

  function splitAtPlayhead() {
    const next = splitAt(edit, durationMs, sourceMs)
    if (!changeEdit(next, `split:${Math.round(sourceMs)}`)) {
      toast.add({
        type: "error",
        title: "Too close to the edge of a part to split here.",
      })
      return
    }
    setSelectedPart(
      partsOf(next, durationMs).findLastIndex((p) => p.startMs <= sourceMs)
    )
    setTool("cuts")
  }
  // The S shortcut reads the latest version.
  const splitRef = useRef(splitAtPlayhead)
  useEffect(() => {
    splitRef.current = splitAtPlayhead
  })

  // ── Text ──
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const stageFonts = useMemo<StageFonts>(
    () => stageFontsFor({ heading: kitFonts.heading, body: kitFonts.body }),
    [kitFonts.heading, kitFonts.body]
  )
  const swatches = useMemo(() => textSwatches(brandColors), [brandColors])
  const accents = useMemo(
    () => [...brandColors, ...(analysis?.palette.accents ?? [])],
    [brandColors, analysis]
  )

  function setTexts(texts: TextItem[], control: string) {
    changePresentation({ ...presentation, texts }, `text:${control}`)
  }

  function newText(patch: Partial<TextItem>): TextItem {
    return {
      id: newItemId("t"),
      atMs: Math.round(sourceMs),
      durationMs: 2500,
      text: "Your headline here",
      role: "headline",
      animation: null,
      x: 0.5,
      y: 0.14,
      align: "center",
      emphasis: "",
      track: 0,
      size: 1,
      color: null,
      highlightColor: null,
      background: null,
      ...patch,
    }
  }

  function addText(
    preset: TextPreset | { text: string },
    place: { atMs?: number; track?: number } = {}
  ) {
    const atMs = Math.round(place.atMs ?? sourceMs)
    const track = place.track ?? freeTrackAt(atMs, 2500)
    const at = (items: TextItem[]) =>
      items.map((item) => ({ ...item, atMs, track }))
    const added = at(
      typeof preset === "object"
        ? [newText({ text: preset.text })]
        : preset === "title"
          ? [
              newText({ role: "kicker", text: "New", y: 0.1 }),
              newText({ text: "Your headline here", y: 0.19 }),
            ]
          : preset === "label"
            ? [newText({ role: "label", text: "Feature name", y: 0.86 })]
            : preset === "caption"
              ? [
                  newText({
                    role: "caption",
                    text: "Say what’s happening here",
                    y: 0.88,
                  }),
                ]
              : [newText({})]
    )
    setTexts([...presentation.texts, ...added], `add:${added[0]!.id}`)
    setSelectedTextId(added.at(-1)!.id)
    setTool("text")
    // Show it: pause where it lands, a moment into its entrance.
    playerRef.current?.pause()
    seek(atMs + 600)
  }

  // ── Layers (text and graphics on the timeline) ──
  /** Every text and graphic as a block, in footage time. */
  const overlays: OverlayBlock[] = [
    ...presentation.texts.map((item) => ({
      id: item.id,
      type: "text" as const,
      track: item.track,
      startMs: item.atMs,
      endMs: toSource(
        edit,
        durationMs,
        toOutputNearest(edit, durationMs, item.atMs) + item.durationMs
      ),
      label: plainText(item.text),
    })),
    ...presentation.graphics.map((item) => ({
      id: item.id,
      type: "graphic" as const,
      track: item.track,
      startMs: item.atMs,
      endMs: toSource(
        edit,
        durationMs,
        toOutputNearest(edit, durationMs, item.atMs) + item.durationMs
      ),
      label: item.text
        ? `${graphicInfo[item.kind].label} · ${item.text}`
        : graphicInfo[item.kind].label,
    })),
  ]
  /** The lowest layer free from `atMs` for `lengthMs` of ad time. */
  function freeTrackAt(atMs: number, lengthMs: number) {
    const end = toSource(
      edit,
      durationMs,
      toOutputNearest(edit, durationMs, atMs) + lengthMs
    )
    return freeTrack(overlays, atMs, Math.max(1, end - atMs))
  }
  function selectOverlay(id: string) {
    const text = presentation.texts.find((t) => t.id === id)
    if (text) {
      setSelectedTextId(id)
      if (!readOnly) setTool("text")
      return
    }
    setSelectedGraphicId(id)
    if (!readOnly) setTool("graphics")
  }
  function moveOverlay(id: string, atMs: number, track: number) {
    if (presentation.texts.some((t) => t.id === id)) {
      setTexts(
        presentation.texts.map((t) =>
          t.id === id ? { ...t, atMs, track } : t
        ),
        `${id}:time`
      )
      setSelectedTextId(id)
    } else {
      updateGraphic(id, { atMs, track }, "time")
      setSelectedGraphicId(id)
    }
  }
  function resizeOverlay(id: string, endMs: number) {
    const text = presentation.texts.find((t) => t.id === id)
    if (text) {
      setTexts(
        presentation.texts.map((t) =>
          t.id === id
            ? { ...t, durationMs: adLengthBetween(text.atMs, endMs, 600) }
            : t
        ),
        `${id}:duration`
      )
      return
    }
    const item = presentation.graphics.find((g) => g.id === id)
    if (item) {
      updateGraphic(
        id,
        { durationMs: adLengthBetween(item.atMs, endMs, 400) },
        "duration"
      )
    }
  }
  /** A preset dragged from a panel onto a layer. */
  function dropItem(payload: DragPayload, atMs: number, track: number) {
    if (payload.type === "text") {
      addText(payload.preset as TextPreset, { atMs, track })
      return
    }
    const kind = payload.kind as GraphicKind
    if (!graphicKinds.includes(kind)) return
    addGraphics([makeGraphic(kind, { atMs, track })])
  }

  /** Delete: the selected text or graphic, in their tools. */
  function removeSelectedItem() {
    if (tool === "text" && selectedTextId) {
      setTexts(
        presentation.texts.filter((item) => item.id !== selectedTextId),
        `remove:${selectedTextId}`
      )
      setSelectedTextId(null)
    } else if (tool === "graphics" && selectedGraphicId) {
      setGraphics(
        presentation.graphics.filter((item) => item.id !== selectedGraphicId),
        `remove:${selectedGraphicId}`
      )
      setSelectedGraphicId(null)
    }
  }

  // ── Graphics ──
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(
    null
  )
  const [pickingGraphic, setPickingGraphic] = useState<string | null>(null)
  const selectedInsight = selected ? parseStoredInsight(selected.insight) : null

  function setGraphics(graphics: GraphicItem[], control: string) {
    changePresentation({ ...presentation, graphics }, `graphic:${control}`)
  }
  function updateGraphic(
    id: string,
    patch: Partial<GraphicItem>,
    control: string
  ) {
    setGraphics(
      presentation.graphics.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      `${id}:${control}`
    )
  }
  /** A new graphic of `kind`, aimed at the selected moment's action. */
  function makeGraphic(
    kind: GraphicKind,
    place: { atMs?: number; track?: number } = {}
  ) {
    const atMs = Math.round(place.atMs ?? sourceMs)
    return newGraphic(kind, {
      atMs,
      track: place.track ?? freeTrackAt(atMs, graphicInfo[kind].durationMs),
      ...(isScreenGraphic(kind) && {
        box: boxFor(selectedAim, selectedInsight),
      }),
      ...(kind === "keys" && { text: "⌘ K" }),
    })
  }
  function addGraphics(added: GraphicItem[]) {
    if (added.length === 0) return
    setGraphics([...presentation.graphics, ...added], `add:${added[0]!.id}`)
    setSelectedGraphicId(added.at(-1)!.id)
    setTool("graphics")
    playerRef.current?.pause()
    // Show it a moment into its entrance (past a split's glide).
    seek(added[0]!.atMs + (isLayoutGraphic(added[0]!.kind) ? 1100 : 500))
  }
  function applyGraphicTemplate(template: GraphicTemplateId, label?: string) {
    if (!selected) return
    const made = buildTemplate(template, {
      atMs: selected.atMs,
      box: boxFor(selectedAim, selectedInsight),
      insight: selectedInsight,
      label,
    })
    // The set shares one free layer (its own kinds stack inside it).
    const track = freeTrackAt(
      selected.atMs,
      Math.max(...made.map((g) => g.durationMs + g.atMs - selected.atMs))
    )
    addGraphics(made.map((g) => ({ ...g, track })))
  }
  async function askAiForGraphic() {
    if (!selected) return
    const result = await suggestMomentGraphic({
      footageId: clip.id,
      markerId: selected.id,
    })
    if (!result.ok) {
      toast.add({ type: "error", title: result.error.message })
      return
    }
    applyGraphicTemplate(result.data.template, result.data.label)
    toast.add({
      type: "success",
      title: `The AI chose ${graphicTemplates[result.data.template].title.toLowerCase()}`,
      description: `${undoKey} undoes it.`,
    })
  }

  function treatStillStretches(action: "speed" | "cut") {
    // A little of each still stretch stays at normal speed, so the cut
    // into and out of it doesn't feel abrupt.
    let next = edit
    for (const range of analysis?.idle ?? []) {
      next = updateRange(
        next,
        durationMs,
        range.startMs + 150,
        range.endMs - 150,
        action === "speed" ? { speed: 4 } : { removed: true }
      )
    }
    if (changeEdit(next, `still:${action}`)) {
      toast.add({
        type: "success",
        title:
          action === "speed"
            ? "Still stretches play at 4×"
            : "Still stretches cut",
        description: `The ad now runs ${formatTimecode(outputDuration(next, durationMs))}. ${undoKey} undoes it.`,
      })
    }
  }

  // Stable for the Player's props; reads the latest selection.
  const pickFocusRef = useRef<(point: { x: number; y: number }) => void>(
    () => {}
  )
  useEffect(() => {
    pickFocusRef.current = ({ x, y }) => {
      if (pickingGraphic) {
        const item = presentation.graphics.find((g) => g.id === pickingGraphic)
        if (item) {
          updateGraphic(
            item.id,
            { box: boxAround(x, y, item.box.w, item.box.h) },
            "place"
          )
        }
        setPickingGraphic(null)
        return
      }
      const shot = selected ? shotOf(selected) : null
      if (selected && shot) {
        changeShotFor(
          selected,
          { ...shot, camera: { ...shot.camera, focusX: x, focusY: y } },
          "focus"
        )
      }
      setPickingFocus(false)
    }
  })
  const onPickFocus = useCallback(
    (point: { x: number; y: number }) => pickFocusRef.current(point),
    []
  )

  function selectMarker(marker: Marker) {
    setSelectedId(marker.id)
    setPickingFocus(false)
    showLanded(marker, shotOf(marker))
  }

  const play = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    // At the end, Play starts again from the beginning.
    if (playerTime(player) >= adDurationMs - 1000 / stageFps - 1) {
      player.seekTo(0)
    }
    player.play()
  }, [adDurationMs])

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) player.pause()
    else {
      // Space always plays forward at normal speed.
      setRate(1)
      play()
    }
  }, [play])

  function stop() {
    playerRef.current?.pause()
    setRate(1)
    seekAd(0)
  }

  // J/K/L shuttle: J plays backwards and L forwards, faster each press
  // (1×, 2×, 4×); K pauses. The Player takes −10…10, never 0.
  function shuttle(direction: -1 | 1) {
    const player = playerRef.current
    if (!player) return
    const playing = player.isPlaying()
    const next =
      playing && Math.sign(rate) === direction
        ? Math.min(4, Math.abs(rate) * 2) * direction
        : direction
    setRate(next)
    if (direction === 1 && playerTime(player) >= adDurationMs - 40)
      player.seekTo(0)
    player.play()
  }
  function stepFrame(frames: number) {
    const player = playerRef.current
    if (!player) return
    player.pause()
    const frame = Math.max(0, player.getCurrentFrame() + frames)
    player.seekTo(frame)
    setCurrentMs((frame / stageFps) * 1000)
  }
  const [showShortcuts, setShowShortcuts] = useState(false)
  // Keys read the latest state through this ref (the listener is stable).
  const keyActions = useRef<Record<string, (event: KeyboardEvent) => void>>({})
  useEffect(() => {
    keyActions.current = {
      j: () => shuttle(-1),
      k: () => {
        playerRef.current?.pause()
        setRate(1)
      },
      l: () => shuttle(1),
      ",": () => stepFrame(-1),
      ".": () => stepFrame(1),
      "?": () => setShowShortcuts(true),
      delete: () => removeSelectedItem(),
      backspace: () => removeSelectedItem(),
    }
  })

  // Dragging the playhead pauses playback, then resumes it if it was on.
  const resumeAfterScrub = useRef(false)
  function onScrubbingChange(scrubbing: boolean) {
    const player = playerRef.current
    if (!player) return
    if (scrubbing) {
      resumeAfterScrub.current = player.isPlaying()
      player.pause()
    } else if (resumeAfterScrub.current) {
      player.play()
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
      } else if (key === "s" && !mod && !event.altKey) {
        event.preventDefault()
        splitRef.current()
      } else if (!mod && !event.altKey && keyActions.current[key]) {
        event.preventDefault()
        keyActions.current[key]!(event)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [readOnly, stepHistory, togglePlay])

  // Space plays and pauses wherever focus is, except while typing.
  useSpaceToPlay(togglePlay)

  function addAtCurrentTime() {
    const atMs = Math.round(
      toSource(edit, durationMs, playerTime(playerRef.current))
    )
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

  // Full screen: the stage alone, edge to edge, to watch the ad as it'll
  // look. Native full screen where the browser allows it on an element;
  // else (iPhone Safari) the stage fills the window.
  const stageBoxRef = useRef<HTMLDivElement>(null)
  const {
    fullscreen,
    enter: enterFullscreen,
    exit: exitFullscreen,
  } = useFullscreen(stageBoxRef)

  // The timeline's height: null fits every layer; a drag on its top edge
  // sets one (kept per browser), and the layers scroll inside.
  const timelineRef = useRef<HTMLElement>(null)
  // The saved height, read after hydration (the server has none).
  const savedTimelineHeight = useSyncExternalStore(
    subscribeToStorage,
    readTimelineHeight,
    () => null
  )
  // A drag this session (undefined: none yet, so the saved one applies).
  const [draggedHeight, setDraggedHeight] = useState<number | null>()
  const timelineHeight =
    draggedHeight === undefined ? savedTimelineHeight : draggedHeight
  const [timelineBoxHeight, setTimelineBoxHeight] = useState(0)
  useEffect(() => {
    const box = timelineRef.current
    if (!box) return
    const observer = new ResizeObserver(() =>
      setTimelineBoxHeight(box.getBoundingClientRect().height)
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const resizeTimeline = useCallback((height: number | null) => {
    setDraggedHeight(height)
    try {
      if (height === null) window.localStorage.removeItem(timelineHeightKey)
      else window.localStorage.setItem(timelineHeightKey, String(height))
    } catch {
      // Private mode: the height just isn't remembered.
    }
  }, [])

  // Keep the open tool's tab in view in the phone's scrolling row.
  const railRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    railRef.current
      ?.querySelector<HTMLElement>("[data-active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [tool])

  // The look applied last and which take, for "New take".
  const [activeLook, setActiveLook] = useState<{
    id: string
    take: number
  } | null>(null)

  function applyLookById(lookId: string, take: number) {
    const moments = markers.map((marker) => ({
      id: marker.id,
      atMs: marker.atMs,
      aim: aimAt({
        analysis,
        recording,
        insight: parseStoredInsight(marker.insight),
        atMs: marker.atMs,
      }),
    }))
    // Each look or take is its own undo step (never merged).
    change(
      applyLook(lookId, moments, history.present, { take }),
      `look:${lookId}:${take}`
    )
    setActiveLook({ id: lookId, take })
    stop()
    play()
  }

  // The last AI edit's reasoning, shown in the AI panel.
  const [lastPlan, setLastPlan] = useState<{
    reasoning: string
    summary: string
  } | null>(null)

  function direct(instruction: string, scope: EditScope) {
    startDirect(async () => {
      const result = await directFootageEdit({
        footageId: clip.id,
        instruction,
        scope,
      })
      if (!result.ok) {
        toast.add({ type: "error", title: result.error.message })
        return
      }
      const next = applyPlan(result.data, {
        moments: markers.map((marker) => {
          const insight = parseStoredInsight(marker.insight)
          return {
            id: marker.id,
            atMs: marker.atMs,
            insight,
            aim: aimAt({ analysis, recording, insight, atMs: marker.atMs }),
          }
        }),
        current: history.present,
        durationMs,
        idle: analysis?.idle ?? [],
        scope,
      })
      // One undoable step; saved like any other change.
      change(
        next,
        `ai:${instruction}:${JSON.stringify(scope)}:${Math.random()}`
      )
      const summary = planSummary(result.data, scope)
      setLastPlan({ reasoning: result.data.reasoning, summary })
      stop()
      play()
      toast.add({
        type: "success",
        title: "Edit directed",
        description: `${summary}. ${undoKey} undoes it.`,
      })
    })
  }

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh">
      <RefreshWhileProcessing active={isAnalysing} />
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:gap-3 sm:px-4">
        {/* Rendered here, not passed in from the server page: elements
            built by the server and handed to this client component came
            back undefined after a server-action refresh, crashing it. */}
        <LinkButton
          href={backTo?.href ?? `/brand-kits/${kitId}/footage`}
          variant="ghost"
          icon={<ArrowLeftIcon />}
        >
          <span className="hidden max-w-40 truncate sm:inline">
            {backTo?.label ?? "Footage"}
          </span>
          <span className="sr-only sm:hidden">
            Back to {backTo ? backTo.label : "footage"}
          </span>
        </LinkButton>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="truncate text-sm font-semibold">
            {video?.single ? video.name : clip.name}
          </h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {video?.single ? clip.name : kitName}
            {clip.durationMs !== null &&
              ` · ${formatDuration(clip.durationMs)}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ShortcutsDialog
            open={showShortcuts}
            onOpenChange={setShowShortcuts}
            mac={mac}
          />
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
                {conflict !== "none"
                  ? "Not saved"
                  : saveState === "saving"
                    ? "Saving…"
                    : saveState === "failed"
                      ? "Not saved"
                      : "Saved"}
              </span>
              {conflict === "dismissed" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </Button>
              )}
              <ConflictDialog
                what="clip"
                open={conflict === "open"}
                onOpenChange={(open) => !open && setConflict("dismissed")}
              />
            </>
          )}
          {!readOnly && video && (
            <LinkButton
              href={video.addClipHref}
              variant="outline"
              icon={<PlusIcon />}
              aria-label="Add clip"
            >
              <span className="hidden sm:inline">Add clip</span>
            </LinkButton>
          )}
          {/* A one-clip video is exported as the video (its share link too). */}
          <ExportDialog
            target={
              video?.single
                ? { kind: "video", id: video.id }
                : { kind: "clip", id: clip.id }
            }
            defaultShape={aspect}
            canEdit={!readOnly}
          />
          {!readOnly && !video && (
            <DeleteClipButton
              footageId={clip.id}
              clipName={clip.name}
              afterDeleteHref={backTo?.href ?? `/brand-kits/${kitId}/footage`}
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
              ref={railRef}
              className="w-full shrink-0 flex-row! justify-start gap-1 overflow-x-auto rounded-none bg-card p-2 lg:h-full! lg:w-20 lg:flex-col! lg:justify-start! lg:self-stretch lg:overflow-x-hidden lg:overflow-y-auto lg:border-r"
            >
              {tools.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  // Vertical tabs are full width; in the phone's row they
                  // size to their label so they all fit side by side.
                  className="h-auto! w-auto! flex-none! flex-col! gap-1 px-2 py-1.5 text-xs lg:w-full! lg:justify-center!"
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
                  palette={analysis?.palette ?? null}
                  activeLook={activeLook}
                  onApplyLook={applyLookById}
                  onReset={() => {
                    change(resetLook(markers, presentation), "reset")
                    setActiveLook(null)
                  }}
                  onBackground={(background) =>
                    changePresentation(
                      { ...presentation, background },
                      "background-preset"
                    )
                  }
                />
              </TabsContent>
              <TabsContent value="cuts">
                <CutsPanel
                  parts={clipParts}
                  selectedIndex={selectedPart}
                  playheadMs={sourceMs}
                  adDurationMs={adDurationMs}
                  durationMs={durationMs}
                  idle={analysis?.idle ?? []}
                  onSelect={(index) => {
                    setSelectedPart(index)
                    const part = clipParts[index]
                    if (part) seek(part.startMs)
                  }}
                  onSplit={splitAtPlayhead}
                  onUpdate={(index, patch) =>
                    changeEdit(
                      updatePart(edit, index, patch),
                      `part:${index}:${Object.keys(patch).join()}`
                    )
                  }
                  onJoin={(index) => {
                    changeEdit(joinWithPrevious(edit, index), `join:${index}`)
                    setSelectedPart(index - 1)
                  }}
                  onIdle={treatStillStretches}
                />
              </TabsContent>
              <TabsContent value="text">
                <TextPanel
                  items={presentation.texts}
                  selectedId={selectedTextId}
                  videoAnimation={presentation.textStyle.animation}
                  playheadMs={sourceMs}
                  fonts={stageFonts}
                  aiHeadline={
                    selected
                      ? (parseStoredInsight(selected.insight)?.headline ?? null)
                      : null
                  }
                  onVideoAnimation={(animation) =>
                    changePresentation(
                      { ...presentation, textStyle: { animation } },
                      "text-style"
                    )
                  }
                  onAdd={addText}
                  onAddText={(text) => addText({ text })}
                  onAddLayout={(kind) => addGraphics([makeGraphic(kind)])}
                  swatches={swatches}
                  onSelect={(id) => {
                    setSelectedTextId(id)
                    const item = presentation.texts.find((t) => t.id === id)
                    if (item) {
                      playerRef.current?.pause()
                      seek(item.atMs + 900)
                    }
                  }}
                  onUpdate={(id, patch, control) =>
                    setTexts(
                      presentation.texts.map((item) =>
                        item.id === id ? { ...item, ...patch } : item
                      ),
                      `${id}:${control}`
                    )
                  }
                  onRemove={(id) => {
                    setTexts(
                      presentation.texts.filter((item) => item.id !== id),
                      `remove:${id}`
                    )
                    setSelectedTextId(null)
                  }}
                />
              </TabsContent>
              <TabsContent value="graphics">
                <GraphicsPanel
                  items={presentation.graphics}
                  selectedId={selectedGraphicId}
                  playheadMs={sourceMs}
                  moment={
                    selected
                      ? {
                          atMs: selected.atMs,
                          hasInsight: selectedInsight !== null,
                        }
                      : null
                  }
                  templates={templatesFor(selectedInsight)}
                  isPicking={pickingGraphic !== null}
                  onApplyTemplate={(template) => applyGraphicTemplate(template)}
                  onAskAi={askAiForGraphic}
                  onAdd={(kind) => addGraphics([makeGraphic(kind)])}
                  swatches={swatches}
                  onSelect={(id) => {
                    setSelectedGraphicId(id)
                    const item = presentation.graphics.find((g) => g.id === id)
                    if (item) {
                      playerRef.current?.pause()
                      seek(item.atMs + 500)
                    }
                  }}
                  onUpdate={updateGraphic}
                  onRemove={(id) => {
                    setGraphics(
                      presentation.graphics.filter((g) => g.id !== id),
                      `remove:${id}`
                    )
                    setSelectedGraphicId(null)
                  }}
                  onTogglePick={() => {
                    playerRef.current?.pause()
                    setPickingGraphic((current) =>
                      current ? null : selectedGraphicId
                    )
                  }}
                />
              </TabsContent>
              <TabsContent value="lens">
                <LensPanel
                  lens={presentation.lens}
                  motionBlur={presentation.motionBlur}
                  onMotionBlur={(motionBlur) =>
                    changePresentation(
                      { ...presentation, motionBlur },
                      "motion-blur"
                    )
                  }
                  shotIsFlat={(() => {
                    const camera = selected ? shotOf(selected)?.camera : null
                    return (
                      !camera ||
                      (Math.abs(camera.tilt) < 1 && Math.abs(camera.turn) < 1)
                    )
                  })()}
                  onChange={(lens, control) =>
                    changePresentation(
                      { ...presentation, lens },
                      `lens:${control}`
                    )
                  }
                />
              </TabsContent>
              <TabsContent value="shot">
                <ShotPanel
                  moment={selected}
                  shot={selected ? shotOf(selected) : null}
                  aim={selectedAim}
                  pickingFocus={pickingFocus}
                  onShotChange={(shot, control) =>
                    selected && changeShotFor(selected, shot, control)
                  }
                  onTogglePick={() => {
                    playerRef.current?.pause()
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
                  palette={analysis?.palette ?? null}
                  onChange={changePresentation}
                />
              </TabsContent>
              <TabsContent value="ai">
                <DirectPanel
                  hasMoments={markers.length > 0}
                  isDirecting={isDirecting}
                  lastPlan={lastPlan}
                  onDirect={direct}
                />
              </TabsContent>
              <TabsContent value="moments">
                <MomentsPanel
                  footageId={clip.id}
                  analysisStatus={clip.analysisStatus}
                  markers={markers}
                  selectedId={selectedId}
                  readOnly={readOnly}
                  shotOf={shotOf}
                  strip={{
                    url: links.thumbnailsUrl,
                    count: clip.thumbnailCount,
                    intervalMs: clip.thumbnailIntervalMs,
                  }}
                  playheadMs={sourceMs}
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
          <div
            ref={stageBoxRef}
            data-testid="stage-box"
            data-fullscreen={fullscreen || undefined}
            className={cn(
              fullscreen
                ? "fixed inset-0 z-50 bg-black"
                : "h-[50vh] bg-muted/60 p-4 sm:p-6 lg:h-auto lg:min-h-0 lg:flex-1"
            )}
          >
            <MotionStage
              bare={fullscreen}
              playerRef={playerRef}
              videoUrl={links.videoUrl}
              posterUrl={links.posterUrl}
              presentation={presentation}
              shots={timedShots}
              durationMs={durationMs}
              fonts={stageFonts}
              accents={accents}
              videoWidth={clip.width ?? 1920}
              videoHeight={clip.height ?? 1080}
              aspect={aspect}
              reduceMotion={reduceMotion}
              pickingFocus={pickingFocus || pickingGraphic !== null}
              onPickFocus={onPickFocus}
              playbackRate={rate}
              playing={isPlaying && rate > 0}
              interactive={!readOnly && !isPlaying && !fullscreen}
              selectedItemId={
                tool === "text"
                  ? selectedTextId
                  : tool === "graphics"
                    ? selectedGraphicId
                    : null
              }
              onSelectItem={selectOverlay}
              onMoveItem={(id, patch) => {
                if (patch.kind === "text") {
                  setTexts(
                    presentation.texts.map((t) =>
                      t.id === id ? { ...t, x: patch.x, y: patch.y } : t
                    ),
                    `${id}:place`
                  )
                } else if (patch.kind === "stage") {
                  updateGraphic(id, { at: patch.at }, "place")
                } else {
                  updateGraphic(id, { box: patch.box }, "place")
                }
              }}
              logoUrl={kitLogoUrl}
              brandName={kitName}
              siteLabel={kitSite}
              onTimeChange={onTimeChange}
              onPlayingChange={onPlayingChange}
              // The Player keeps its frame; the fresh link loads there.
              onVideoError={renewLinks}
            />
            {fullscreen && (
              <FullscreenControls
                isPlaying={isPlaying}
                currentMs={currentMs}
                durationMs={adDurationMs}
                onTogglePlay={togglePlay}
                onSeek={seekAd}
                onExit={exitFullscreen}
              />
            )}
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
              {formatTimecode(currentMs)} / {formatTimecode(adDurationMs)}
            </span>
            {rate !== 1 && isPlaying && (
              <span
                className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs"
                aria-live="polite"
              >
                {rate < 0 ? `◀ ${Math.abs(rate)}×` : `${rate}× ▶`}
              </span>
            )}
            {reduceMotion && (
              <span className="text-xs text-muted-foreground">
                Reduced motion: the preview cuts between shots.
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="ml-auto"
              aria-label="Full screen"
              title="Full screen (F)"
              onClick={enterFullscreen}
            >
              <MaximizeIcon />
            </Button>
            <ToggleGroup
              aria-label="Preview shape"
              variant="outline"
              size="sm"
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

      {/* Timeline, full width; its top edge resizes it. */}
      <footer
        ref={timelineRef}
        data-testid="timeline-panel"
        className="order-2 flex shrink-0 flex-col border-t bg-card lg:order-none"
        style={{ height: timelineHeight ?? undefined }}
      >
        <TimelineResizeHandle
          height={timelineHeight}
          current={timelineBoxHeight}
          onResize={resizeTimeline}
        />
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-4">
          <div className="mb-2 flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FilmIcon aria-hidden className="size-4" />
              Timeline
            </span>
            {idleMs > 0 && (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <span
                  aria-hidden
                  className="size-3 rounded-sm border bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_2px,transparent_2px_5px)]"
                />
                Nothing changes on screen ({(idleMs / 1000).toFixed(1)} s)
              </span>
            )}
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
                <span className="font-mono">{formatTimecode(sourceMs)}</span>
              </Button>
            )}
          </div>
          {/* Layers beyond the height scroll; the ruler stays on top. */}
          <div
            data-testid="timeline-scroll"
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <ClipTimeline
              durationMs={durationMs}
              currentMs={sourceMs}
              thumbnailsUrl={links.thumbnailsUrl}
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
              idle={analysis?.idle}
              clipParts={clipParts}
              overlays={overlays}
              selectedOverlay={
                tool === "text"
                  ? selectedTextId
                  : tool === "graphics"
                    ? selectedGraphicId
                    : null
              }
              onSelectOverlay={selectOverlay}
              {...(!readOnly && {
                onMoveOverlay: moveOverlay,
                onResizeOverlay: resizeOverlay,
                onDropItem: dropItem,
              })}
              selectedPart={tool === "cuts" ? selectedPart : null}
              onSelectPart={(index) => {
                setSelectedPart(index)
                if (!readOnly) setTool("cuts")
              }}
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
          </div>
        </div>
      </footer>
    </div>
  )
}
