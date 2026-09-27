"use client"

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CombineIcon,
  FastForwardIcon,
  ScissorsIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  enterStyle,
  exitStyle,
  type LayerLook,
} from "@/remotion/compositions/FootageStage"
import { cn } from "@/shared/lib/utils"
import {
  speeds,
  transitionDefaults,
  transitionKinds,
  type Part,
  type TimedPart,
  type Transition,
  type TransitionDirection,
  type TransitionKind,
} from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { Field, FieldDescription } from "@/shared/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import { formatTimecode } from "../lib/format"
import { PanelHeading, SliderField } from "./editor-panels"

const directionIcons: Record<TransitionDirection, React.ComponentType> = {
  left: ArrowLeftIcon,
  right: ArrowRightIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
}

const lookCss = (look: LayerLook): React.CSSProperties => ({
  transform: look.transform,
  opacity: look.opacity,
  clipPath: look.clipPath,
  filter: look.blur
    ? `blur(${look.blur.toFixed(2)}px)`
    : look.whipBlur
      ? `blur(${(look.whipBlur / 2).toFixed(2)}px)`
      : undefined,
})

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * A live thumbnail of a transition: two panes swapping with the real
 * transition code (the same functions the video uses), on a loop.
 * Still (halfway) for reduced-motion users.
 */
function TransitionPreview({ transition }: { transition: Transition }) {
  const [t, setT] = useState(0.5)
  const reduce = useRef(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    reduce.current = query.matches
    const unsubscribe = subscribeReducedMotion(() => {
      reduce.current = query.matches
    })
    if (transition.kind === "cut") return unsubscribe
    let raf = 0
    const started = performance.now()
    // Hold, swap, hold, swap back: 2.4s per loop.
    const tick = (now: number) => {
      if (reduce.current) {
        setT(0.5)
      } else {
        const phase = ((now - started) % 2400) / 2400
        const swap = (p: number) => Math.min(1, Math.max(0, p))
        setT(
          phase < 0.5
            ? swap((phase - 0.25) / 0.2)
            : 1 - swap((phase - 0.75) / 0.2)
        )
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
    }
  }, [transition.kind])

  const unit = 0.6 // a thumbnail is ~60px wide
  const at = { x: 0.5, y: 0.5 }
  const cut = transition.kind === "cut"
  const incoming = cut ? {} : t < 1 ? enterStyle(transition, t, at, unit) : {}
  const outgoing = cut ? {} : t > 0 ? exitStyle(transition, t, unit) : {}
  return (
    <span
      aria-hidden
      className="relative block h-10 w-full overflow-hidden rounded-md bg-muted"
    >
      <span
        className="absolute inset-0 flex items-center justify-center bg-foreground/70"
        style={lookCss(outgoing)}
      >
        <span className="h-1.5 w-6 rounded-full bg-background/80" />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center bg-chroma-strong"
        style={cut ? { opacity: t >= 0.5 ? 1 : 0 } : lookCss(incoming)}
      >
        <span className="size-3 rounded-full bg-background/80" />
      </span>
    </span>
  )
}

/**
 * Cuts, speed and transitions (§7.4b D): split the footage into parts,
 * cut or speed them up, and choose how each part comes in.
 */
export function CutsPanel({
  parts,
  selectedIndex,
  playheadMs,
  adDurationMs,
  durationMs,
  idle,
  onSelect,
  onSplit,
  onUpdate,
  onJoin,
  onIdle,
}: {
  parts: TimedPart[]
  selectedIndex: number | null
  playheadMs: number
  adDurationMs: number
  durationMs: number
  idle: { startMs: number; endMs: number }[]
  onSelect: (index: number) => void
  onSplit: () => void
  onUpdate: (index: number, patch: Partial<Omit<Part, "startMs">>) => void
  onJoin: (index: number) => void
  onIdle: (action: "speed" | "cut") => void
}) {
  const selected = selectedIndex === null ? null : parts[selectedIndex]
  const firstKept = parts.find((part) => !part.removed)?.index
  const idleMs = idle.reduce((sum, r) => sum + r.endMs - r.startMs, 0)
  const saved = durationMs - adDurationMs

  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Cuts & speed"
        description="Split the footage into parts, then cut them, speed them up, or pick how each one comes in."
      />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          aria-keyshortcuts="S"
          onClick={onSplit}
        >
          <ScissorsIcon data-icon="inline-start" />
          Split at{" "}
          <span className="font-mono">{formatTimecode(playheadMs)}</span>
          <kbd
            aria-hidden
            className="ml-auto rounded border px-1.5 font-mono text-xs text-muted-foreground"
          >
            S
          </kbd>
        </Button>
        <p className="text-xs text-muted-foreground">
          The ad runs {formatTimecode(adDurationMs)}
          {saved > 50
            ? `, ${(saved / 1000).toFixed(1)} s shorter than the footage.`
            : "."}
        </p>
      </div>

      {idle.length > 0 && (
        <section
          className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
          aria-labelledby="still-heading"
        >
          <h3 id="still-heading" className="text-sm font-medium">
            Still stretches
          </h3>
          <p className="text-xs text-muted-foreground">
            Nothing changes on screen for {(idleMs / 1000).toFixed(1)} s in{" "}
            {idle.length} {idle.length === 1 ? "place" : "places"}. Viewers
            scroll past still screens.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onIdle("speed")}
            >
              <FastForwardIcon data-icon="inline-start" />
              Speed them up
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onIdle("cut")}
            >
              <ScissorsIcon data-icon="inline-start" />
              Cut them
            </Button>
          </div>
        </section>
      )}

      <ul className="flex flex-col gap-1.5" aria-label="Parts">
        {parts.map((part) => (
          <li key={part.startMs}>
            <button
              type="button"
              aria-pressed={part.index === selectedIndex}
              onClick={() => onSelect(part.index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                part.index === selectedIndex &&
                  "border-ring ring-2 ring-ring/25",
                part.removed && "text-muted-foreground line-through"
              )}
            >
              <span className="font-medium">Part {part.index + 1}</span>
              <span className="font-mono text-xs">
                {formatTimecode(part.startMs)}–{formatTimecode(part.endMs)}
              </span>
              <span className="ml-auto text-xs no-underline">
                {part.removed
                  ? "Cut"
                  : [
                      part.speed !== 1 ? `${part.speed}×` : null,
                      part.transition.kind !== "cut" && part.index !== firstKept
                        ? transitionDefaults[part.transition.kind].label
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <PartInspector
          key={selected.startMs}
          part={selected}
          isFirstKept={selected.index === firstKept}
          onUpdate={(patch) => onUpdate(selected.index, patch)}
          onJoin={selected.index > 0 ? () => onJoin(selected.index) : undefined}
        />
      )}
    </div>
  )
}

function PartInspector({
  part,
  isFirstKept,
  onUpdate,
  onJoin,
}: {
  part: TimedPart
  isFirstKept: boolean
  onUpdate: (patch: Partial<Omit<Part, "startMs">>) => void
  onJoin?: () => void
}) {
  const { transition } = part
  const kind = transitionDefaults[transition.kind]
  const setTransition = (next: Partial<Transition>) =>
    onUpdate({ transition: { ...transition, ...next } })

  return (
    <section
      className="flex flex-col gap-5 border-t pt-5"
      aria-labelledby="part-heading"
    >
      <h3 id="part-heading" className="text-sm font-medium">
        Part {part.index + 1} · {formatTimecode(part.startMs)}–
        {formatTimecode(part.endMs)}
      </h3>

      <Field>
        <span className="text-sm font-medium">In the ad</span>
        <ToggleGroup
          aria-label="In the ad"
          variant="outline"
          className="grid grid-cols-2 gap-2"
          value={[part.removed ? "cut" : "keep"]}
          onValueChange={(values) => {
            const value = values[0]
            if (value) onUpdate({ removed: value === "cut" })
          }}
        >
          <ToggleGroupItem value="keep" className="w-full">
            Keep
          </ToggleGroupItem>
          <ToggleGroupItem value="cut" className="w-full">
            <Trash2Icon data-icon="inline-start" />
            Cut out
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {!part.removed && (
        <Field>
          <span className="text-sm font-medium">Speed</span>
          <ToggleGroup
            aria-label="Speed"
            variant="outline"
            className="grid grid-cols-5 gap-1"
            value={[String(part.speed)]}
            onValueChange={(values) => {
              const value = Number(values[0])
              if (value) onUpdate({ speed: value })
            }}
          >
            {speeds.map((speed) => (
              <ToggleGroupItem
                key={speed}
                value={String(speed)}
                className="w-full font-mono"
              >
                {speed}×
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            Speed up typing, loading and scrolling; keep key moments at 1×.
          </FieldDescription>
        </Field>
      )}

      {!part.removed && !isFirstKept && (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium" id="transition-label">
            Comes in with
          </span>
          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-labelledby="transition-label"
          >
            {transitionKinds.map((name) => {
              const preset = transitionDefaults[name]
              const isCurrent = transition.kind === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() =>
                    setTransition({
                      kind: name,
                      durationMs: preset.durationMs,
                      direction: preset.directions.includes(
                        transition.direction
                      )
                        ? transition.direction
                        : (preset.directions[0] ?? "left"),
                    })
                  }
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border bg-background p-1.5 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    isCurrent && "border-ring ring-2 ring-ring/40"
                  )}
                >
                  <TransitionPreview
                    transition={{
                      kind: name as TransitionKind,
                      durationMs: preset.durationMs,
                      direction:
                        isCurrent &&
                        preset.directions.includes(transition.direction)
                          ? transition.direction
                          : (preset.directions[0] ?? "left"),
                    }}
                  />
                  {preset.label}
                </button>
              )
            })}
          </div>

          {kind.directions.length > 0 && (
            <ToggleGroup
              aria-label="Direction"
              variant="outline"
              className="flex gap-1"
              value={[transition.direction]}
              onValueChange={(values) => {
                const direction = values[0] as TransitionDirection | undefined
                if (direction) setTransition({ direction })
              }}
            >
              {kind.directions.map((direction) => {
                const Icon = directionIcons[direction]
                return (
                  <ToggleGroupItem
                    key={direction}
                    value={direction}
                    aria-label={`Toward the ${direction}`}
                  >
                    <Icon />
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          )}

          {transition.kind !== "cut" && (
            <SliderField
              label="Length"
              value={transition.durationMs}
              min={200}
              max={1200}
              step={50}
              format={(ms) => `${(ms / 1000).toFixed(2)} s`}
              onChange={(durationMs) => setTransition({ durationMs })}
            />
          )}
        </div>
      )}

      {onJoin && (
        <div>
          <Button type="button" variant="ghost" onClick={onJoin}>
            <CombineIcon data-icon="inline-start" />
            Join with part {part.index}
          </Button>
        </div>
      )}
    </section>
  )
}
