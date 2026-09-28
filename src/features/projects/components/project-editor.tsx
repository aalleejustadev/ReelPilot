"use client"

import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useRef, useState } from "react"

import { formatDuration, stageFontsFor } from "@/features/footage/client"
import { projectSlots } from "@/remotion/compositions/ProjectStage"
import { cn } from "@/shared/lib/utils"
import { err, type Result } from "@/shared/lib/result"
import {
  clipAt,
  defaultClipTransition,
  projectLimits,
  transitionDefaults,
  transitionKinds,
  type Transition,
  type TransitionKind,
} from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { ConflictDialog } from "@/shared/ui/conflict-dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import { LinkButton } from "@/shared/ui/link-button"
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

import { saveProjectClips } from "../actions"
import type { ProjectDetail } from "../queries"
import { AddClipsDialog, type KitClip } from "./add-clips-dialog"
import { DeleteProjectButton } from "./delete-project-button"
import { ProjectPlayer } from "./project-player"
import { RenameProject } from "./rename-project"

/** One clip in the list, as edited here (the key keeps React's order). */
type Entry = { key: string; footageId: string; transition: Transition }

let nextKey = 0
const newKey = () => `c${++nextKey}`

const directionLabels = {
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
} as const

/**
 * A project: its clips in order, played as one video, with a transition
 * at every join. Each clip is edited in the clip editor; here the owner
 * picks, orders and joins them. Changes save at once, versioned: a stale
 * tab is told to reload instead of overwriting newer work.
 */
export function ProjectEditor({
  project,
  kitClips,
  readOnly,
}: {
  project: ProjectDetail
  /** The brand kit's clips, for "Add clips". */
  kitClips: KitClip[]
  readOnly: boolean
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>(() =>
    project.clips.map((clip) => ({
      key: newKey(),
      footageId: clip.footageId,
      transition: clip.transition,
    }))
  )
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">(
    "saved"
  )
  const [conflict, setConflict] = useState<"none" | "open" | "dismissed">(
    "none"
  )
  const [adding, setAdding] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const seekRef = useRef<((ms: number) => void) | null>(null)
  const version = useRef(project.version)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const conflicted = useRef(false)
  const pending = useRef(0)

  // Media for each clip from the server (a clip just added arrives with
  // the refresh that follows its save).
  const media = useMemo(
    () => new Map(project.clips.map((clip) => [clip.footageId, clip])),
    [project.clips]
  )
  const kitClipById = useMemo(
    () => new Map(kitClips.map((clip) => [clip.id, clip])),
    [kitClips]
  )

  /** Saves the list, one save after another, from the version we have. */
  const save = useCallback(
    (next: Entry[], options: { refresh?: boolean } = {}) => {
      pending.current++
      setSaveState("saving")
      const run = queue.current.then(async (): Promise<Result<unknown>> => {
        if (conflicted.current) {
          return err({ code: "CONFLICT", message: "Changed elsewhere" })
        }
        const result = await saveProjectClips({
          projectId: project.id,
          baseVersion: version.current,
          clips: next.map(({ footageId, transition }) => ({
            footageId,
            transition,
          })),
        })
        if (result.ok) version.current = result.data.version
        return result
      })
      queue.current = run.catch(() => {})
      void run.then((result) => {
        pending.current--
        if (!result.ok && result.error.code === "CONFLICT") {
          if (!conflicted.current) setConflict("open")
          conflicted.current = true
          setSaveState("failed")
          return
        }
        if (!result.ok) {
          setSaveState("failed")
          toast.add({ type: "error", title: result.error.message })
          return
        }
        if (pending.current === 0) setSaveState("saved")
        // New clips' video and edit come from the server.
        if (options.refresh) router.refresh()
      })
    },
    [project.id, router]
  )

  function change(next: Entry[], options?: { refresh?: boolean }) {
    setEntries(next)
    save(next, options)
  }

  /**
   * Moves a clip. Transitions belong to the joins (shown between the
   * cards), as in a timeline: the clips change places, the joins stay.
   */
  function move(index: number, to: number) {
    if (to < 0 || to >= entries.length || to === index) return
    const order = [...entries]
    const [moved] = order.splice(index, 1)
    order.splice(to, 0, moved!)
    change(
      order.map((entry, i) => ({
        ...entry,
        transition: entries[i]!.transition,
      }))
    )
  }

  function setTransition(index: number, transition: Transition) {
    change(
      entries.map((entry, i) =>
        i === index ? { ...entry, transition } : entry
      )
    )
  }

  function add(footageIds: string[]) {
    const room = projectLimits.clips - entries.length
    change(
      [
        ...entries,
        ...footageIds.slice(0, room).map((footageId) => ({
          key: newKey(),
          footageId,
          transition: defaultClipTransition,
        })),
      ],
      { refresh: true }
    )
  }

  // What plays: the clips whose media we have, in order.
  const { playable, stageClips } = useMemo(() => {
    const playable = entries.flatMap((entry) => {
      const clip = media.get(entry.footageId)
      return clip?.videoUrl ? [{ entry, clip }] : []
    })
    return {
      playable,
      stageClips: playable.map(({ entry, clip }) => ({
        id: clip.footageId,
        videoUrl: clip.videoUrl!,
        posterUrl: clip.posterUrl,
        videoWidth: clip.videoWidth,
        videoHeight: clip.videoHeight,
        presentation: clip.presentation,
        shots: clip.shots,
        durationMs: clip.durationMs,
        transition: entry.transition,
      })),
    }
  }, [entries, media])
  const { slots } = projectSlots(stageClips)
  const current = stageClips.length > 0 ? clipAt(slots, currentMs) : -1
  const currentKey = playable[current]?.entry.key

  const fonts = useMemo(
    () => stageFontsFor(project.kit.fonts),
    [project.kit.fonts]
  )
  const brandColors = useMemo(
    () =>
      [
        project.kit.colors.primary,
        project.kit.colors.secondary,
        project.kit.colors.accent,
      ].filter((color): color is string => Boolean(color)),
    [project.kit.colors]
  )
  // A link that expired (they last an hour): the page re-signs them.
  const lastRefresh = useRef(0)
  const renewLinks = useCallback(() => {
    if (Date.now() - lastRefresh.current < 10_000) return
    lastRefresh.current = Date.now()
    router.refresh()
  }, [router])
  const playerInput = useMemo(
    () => ({
      clips: stageClips,
      fonts,
      accents: brandColors,
      logoUrl: project.kit.logoUrl,
      brandName: project.kit.name,
      siteLabel: siteLabelFor(project.kit.url),
      onVideoError: renewLinks,
    }),
    [stageClips, fonts, brandColors, project.kit, renewLinks]
  )

  const readyInKit = kitClips.filter((clip) => clip.status === "READY")

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:gap-3 sm:px-4">
        <LinkButton href="/projects" variant="ghost" icon={<ArrowLeftIcon />}>
          <span className="hidden sm:inline">Projects</span>
          <span className="sr-only sm:hidden">Back to projects</span>
        </LinkButton>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <RenameProject
            projectId={project.id}
            name={project.name}
            readOnly={readOnly}
          />
          <p className="truncate font-mono text-xs text-muted-foreground">
            {project.kit.name} · {entries.length}{" "}
            {entries.length === 1 ? "clip" : "clips"}
          </p>
        </div>
        {!readOnly && (
          <>
            <span
              className="text-xs whitespace-nowrap text-muted-foreground"
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
              what="project"
              open={conflict === "open"}
              onOpenChange={(open) => !open && setConflict("dismissed")}
            />
            <DeleteProjectButton projectId={project.id} name={project.name} />
          </>
        )}
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        {stageClips.length > 0 ? (
          <ProjectPlayer
            input={playerInput}
            onTimeChange={setCurrentMs}
            seekRef={seekRef}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-muted/60 p-6">
            <Empty className="max-w-lg border bg-background">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FilmIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {entries.length > 0 ? "Loading your clips" : "No clips yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {readOnly
                    ? "An owner or editor can add clips."
                    : readyInKit.length > 0
                      ? `Add clips from ${project.kit.name}’s footage. They play one after another, each with its own edit.`
                      : `${project.kit.name} has no ready footage yet. Record or upload some first.`}
                </EmptyDescription>
              </EmptyHeader>
              {!readOnly && entries.length === 0 && (
                <EmptyContent>
                  {readyInKit.length > 0 ? (
                    <Button type="button" onClick={() => setAdding(true)}>
                      <PlusIcon data-icon="inline-start" />
                      Add clips
                    </Button>
                  ) : (
                    <LinkButton href={`/brand-kits/${project.kit.id}/footage`}>
                      Go to footage
                    </LinkButton>
                  )}
                </EmptyContent>
              )}
            </Empty>
          </div>
        )}
      </main>

      {entries.length > 0 && (
        <footer className="shrink-0 border-t bg-card px-3 py-3 sm:px-4">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <FilmIcon aria-hidden className="size-4" />
              Clips
            </h2>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={entries.length >= projectLimits.clips}
                onClick={() => setAdding(true)}
              >
                <PlusIcon data-icon="inline-start" />
                Add clips
              </Button>
            )}
          </div>
          <ol
            aria-label="Clips in the project"
            className="flex items-stretch gap-2 overflow-x-auto pb-2"
          >
            {entries.map((entry, index) => {
              const clip = media.get(entry.footageId)
              const info = kitClipById.get(entry.footageId)
              const name = clip?.name ?? info?.name ?? "Clip"
              const slot = clip
                ? slots[playable.findIndex((p) => p.entry.key === entry.key)]
                : undefined
              return (
                <li
                  key={entry.key}
                  className="flex shrink-0 items-stretch gap-2"
                >
                  {index > 0 && (
                    <JoinControl
                      index={index}
                      transition={entry.transition}
                      readOnly={readOnly}
                      onChange={(transition) =>
                        setTransition(index, transition)
                      }
                    />
                  )}
                  <ClipCard
                    index={index}
                    name={name}
                    posterUrl={clip?.posterUrl ?? info?.posterUrl ?? null}
                    lengthMs={clip?.lengthMs ?? null}
                    isCurrent={entry.key === currentKey}
                    isFirst={index === 0}
                    isLast={index === entries.length - 1}
                    readOnly={readOnly}
                    editHref={`/brand-kits/${project.kit.id}/footage/${entry.footageId}?project=${project.id}`}
                    onJump={() =>
                      slot && seekRef.current?.(slot.startMs + slot.inMs)
                    }
                    onMove={(to) => move(index, to)}
                    onDropFrom={(from) => move(from, index)}
                    onRemove={() =>
                      change(entries.filter((_, i) => i !== index))
                    }
                  />
                </li>
              )
            })}
          </ol>
        </footer>
      )}

      {!readOnly && (
        <AddClipsDialog
          open={adding}
          onOpenChange={setAdding}
          kitId={project.kit.id}
          kitName={project.kit.name}
          clips={kitClips}
          room={projectLimits.clips - entries.length}
          onAdd={(ids) => {
            add(ids)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

/** "https://www.acme.app/pricing" → "acme.app" (for end cards). */
function siteLabelFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function ClipCard({
  index,
  name,
  posterUrl,
  lengthMs,
  isCurrent,
  isFirst,
  isLast,
  readOnly,
  editHref,
  onJump,
  onMove,
  onDropFrom,
  onRemove,
}: {
  index: number
  name: string
  posterUrl: string | null
  /** Its edited length; null until its media arrives. */
  lengthMs: number | null
  isCurrent: boolean
  isFirst: boolean
  isLast: boolean
  readOnly: boolean
  editHref: string
  onJump: () => void
  onMove: (to: number) => void
  /** A card dragged from `from` dropped here. */
  onDropFrom: (from: number) => void
  onRemove: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      data-testid="project-clip"
      data-current={isCurrent || undefined}
      draggable={!readOnly}
      onDragStart={(event) => {
        event.dataTransfer.setData(
          "application/x-reelpilot-clip",
          String(index)
        )
        event.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("application/x-reelpilot-clip"))
          return
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        setDragOver(false)
        const from = Number(
          event.dataTransfer.getData("application/x-reelpilot-clip")
        )
        if (Number.isInteger(from) && from !== index) {
          event.preventDefault()
          // Dropped on this card: the dragged clip takes its place.
          onDropFrom(from)
        }
      }}
      className={cn(
        "flex w-44 flex-col overflow-hidden rounded-lg border bg-background",
        isCurrent && "border-ring ring-2 ring-ring/30",
        dragOver && "border-dashed border-ring"
      )}
    >
      <button
        type="button"
        onClick={onJump}
        disabled={lengthMs === null}
        aria-label={`Play from clip ${index + 1}: ${name}`}
        className="relative aspect-video w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, expiring link
          <img
            src={posterUrl}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
        ) : (
          <FilmIcon
            aria-hidden
            className="m-auto size-5 text-muted-foreground"
          />
        )}
        <span className="absolute top-1 left-1 rounded bg-background/85 px-1.5 font-mono text-xs">
          {index + 1}
        </span>
      </button>
      <div className="flex flex-col gap-1 p-2">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {lengthMs === null ? "Loading…" : formatDuration(lengthMs)}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${name} earlier`}
              disabled={isFirst}
              onClick={() => onMove(index - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${name} later`}
              disabled={isLast}
              onClick={() => onMove(index + 1)}
            >
              <ChevronRightIcon />
            </Button>
            <LinkButton
              href={editHref}
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${name}`}
              title="Edit this clip"
            >
              <PencilIcon />
            </LinkButton>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label={`Remove ${name} from the project`}
              onClick={onRemove}
            >
              <XIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The transition into a clip, between its card and the one before. */
function JoinControl({
  index,
  transition,
  readOnly,
  onChange,
}: {
  index: number
  transition: Transition
  readOnly: boolean
  onChange: (transition: Transition) => void
}) {
  const defaults = transitionDefaults[transition.kind]
  const label = `Transition into clip ${index + 1}`
  if (readOnly) {
    return (
      <span className="self-center font-mono text-xs text-muted-foreground">
        {defaults.label}
      </span>
    )
  }
  return (
    <div className="flex w-32 flex-col justify-center gap-1.5">
      <Select
        items={transitionKinds.map((kind) => ({
          value: kind,
          label: transitionDefaults[kind].label,
        }))}
        value={transition.kind}
        onValueChange={(value) => {
          const kind = value as TransitionKind | null
          if (!kind) return
          const next = transitionDefaults[kind]
          onChange({
            kind,
            durationMs: next.durationMs,
            direction: next.directions.includes(transition.direction)
              ? transition.direction
              : (next.directions[0] ?? "left"),
          })
        }}
      >
        <SelectTrigger aria-label={label} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {transitionKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {transitionDefaults[kind].label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {defaults.directions.length > 0 && (
        <ToggleGroup
          aria-label={`${label}: direction`}
          variant="outline"
          size="sm"
          className="grid w-full grid-cols-4 gap-0.5"
          value={[transition.direction]}
          onValueChange={(values) => {
            const direction = values[0] as Transition["direction"] | undefined
            if (direction) onChange({ ...transition, direction })
          }}
        >
          {defaults.directions.map((direction) => (
            <ToggleGroupItem
              key={direction}
              value={direction}
              aria-label={directionLabels[direction]}
              className="px-0 text-xs"
            >
              {directionLabels[direction][0]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  )
}
