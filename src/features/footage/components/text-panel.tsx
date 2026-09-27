"use client"

import {
  AlignCenterIcon,
  ClockIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  AnimatedText,
  textColors,
  type StageFonts,
} from "@/remotion/components/TextLayer"
import { cn } from "@/shared/lib/utils"
import {
  plainText,
  textAnimationLabels,
  textAnimations,
  textLimits,
  textRoleLabels,
  textRoles,
  type TextAnimation,
  type TextItem,
  type TextRole,
} from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Textarea } from "@/shared/ui/textarea"

import { formatTimecode } from "../lib/format"
import { PanelHeading, SliderField } from "./editor-panels"
import { draggablePreset, LayerControl } from "./layer-control"

/** Ready-made text to add at the playhead. */
export type TextPreset = "headline" | "title" | "label" | "caption"

const presets: { id: TextPreset; title: string; hint: string }[] = [
  { id: "headline", title: "Headline", hint: "Big, bold line" },
  { id: "title", title: "Title card", hint: "Kicker over a headline" },
  { id: "label", title: "Label", hint: "A pill that names a feature" },
  { id: "caption", title: "Caption", hint: "A line on a soft backdrop" },
]

const sampleText: Partial<Record<TextAnimation, string>> = {
  "keyword-swap": "Ship {faster|safer}",
  "number-ticker": "Save 12 hours",
  typewriter: "Ship faster",
}

/**
 * A text style, previewed with the stage's own animation code on a loop
 * (2.5s). Settled, not moving, for reduced-motion users.
 */
function AnimationPreview({
  animation,
  fontFamily,
}: {
  animation: TextAnimation
  fontFamily: string
}) {
  const [frame, setFrame] = useState(60)
  const reduce = useRef(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    reduce.current = query.matches
    const onChange = () => (reduce.current = query.matches)
    query.addEventListener("change", onChange)
    let raf = 0
    const started = performance.now()
    const tick = (now: number) => {
      setFrame(
        reduce.current ? 60 : Math.floor(((now - started) / 1000) * 30) % 75
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      query.removeEventListener("change", onChange)
    }
  }, [])
  const item: TextItem = {
    id: "preview",
    atMs: 0,
    durationMs: 2500,
    text: sampleText[animation] ?? "Ship faster",
    role: "headline",
    animation,
    x: 0.5,
    y: 0.5,
    align: "center",
    emphasis: animation === "marker-sweep" ? "faster" : "",
    track: 0,
  }
  const colors = textColors(
    { kind: "solid", from: "#15171c", to: "#15171c" },
    []
  )
  return (
    <span
      aria-hidden
      className="flex h-12 w-full items-center justify-center overflow-hidden rounded-md bg-foreground px-1 text-center text-[13px] font-bold whitespace-nowrap text-background"
      style={{ fontFamily }}
    >
      <span>
        <AnimatedText
          item={item}
          animation={animation}
          frame={frame}
          colors={colors}
        />
      </span>
    </span>
  )
}

const spots = [
  { label: "Top left", x: 0.08, y: 0.12, align: "left" },
  { label: "Top", x: 0.5, y: 0.12, align: "center" },
  { label: "Top right", x: 0.92, y: 0.12, align: "right" },
  { label: "Left", x: 0.08, y: 0.5, align: "left" },
  { label: "Centre", x: 0.5, y: 0.5, align: "center" },
  { label: "Right", x: 0.92, y: 0.5, align: "right" },
  { label: "Bottom left", x: 0.08, y: 0.88, align: "left" },
  { label: "Bottom", x: 0.5, y: 0.88, align: "center" },
  { label: "Bottom right", x: 0.92, y: 0.88, align: "right" },
] as const

/** Text on the ad (§7.4b E): the video's style, items, and each one's settings. */
export function TextPanel({
  items,
  selectedId,
  videoAnimation,
  playheadMs,
  fonts,
  aiHeadline,
  onVideoAnimation,
  onAdd,
  onAddText,
  onSelect,
  onUpdate,
  onRemove,
}: {
  items: TextItem[]
  selectedId: string | null
  videoAnimation: TextAnimation
  playheadMs: number
  fonts: StageFonts
  /** The selected moment's headline idea from the analysis. */
  aiHeadline: string | null
  onVideoAnimation: (animation: TextAnimation) => void
  onAdd: (preset: TextPreset) => void
  onAddText: (text: string) => void
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<TextItem>, control: string) => void
  onRemove: (id: string) => void
}) {
  const selected = items.find((item) => item.id === selectedId) ?? null
  const ordered = [...items].sort((a, b) => a.atMs - b.atMs)

  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Text"
        description="Headlines, labels and captions in your brand fonts. One text style for the whole video keeps it looking designed."
      />

      <section
        className="flex flex-col gap-2"
        aria-labelledby="add-text-heading"
      >
        <h3 id="add-text-heading" className="text-sm font-medium">
          Add at <span className="font-mono">{formatTimecode(playheadMs)}</span>
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title="Click to add at the playhead, or drag onto the timeline"
              {...draggablePreset({ type: "text", preset: preset.id })}
              onClick={() => onAdd(preset.id)}
              disabled={items.length >= textLimits.items}
              className="flex flex-col gap-0.5 rounded-lg border bg-background p-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <PlusIcon aria-hidden className="size-3.5" />
                {preset.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {preset.hint}
              </span>
            </button>
          ))}
        </div>
        {aiHeadline && (
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start py-2 text-left whitespace-normal"
            onClick={() => onAddText(aiHeadline)}
          >
            <SparklesIcon data-icon="inline-start" />
            <span>
              Add the AI’s headline for this moment:{" "}
              <span className="font-medium">“{aiHeadline}”</span>
            </span>
          </Button>
        )}
      </section>

      <section
        className="flex flex-col gap-2"
        aria-labelledby="text-style-heading"
      >
        <h3 id="text-style-heading" className="text-sm font-medium">
          Text style for this video
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {textAnimations.map((animation) => (
            <button
              key={animation}
              type="button"
              aria-pressed={videoAnimation === animation}
              onClick={() => onVideoAnimation(animation)}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border bg-background p-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                videoAnimation === animation &&
                  "border-ring ring-2 ring-ring/40"
              )}
            >
              <AnimationPreview
                animation={animation}
                fontFamily={fonts.heading}
              />
              <span className="px-0.5 font-medium">
                {textAnimationLabels[animation].label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {textAnimationLabels[videoAnimation].hint}
        </p>
      </section>

      {ordered.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Text items">
          {ordered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={item.id === selectedId}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  item.id === selectedId && "border-ring ring-2 ring-ring/25"
                )}
              >
                <span className="font-mono text-xs">
                  {formatTimecode(item.atMs)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {plainText(item.text)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {textRoleLabels[item.role]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <TextInspector
          key={selected.id}
          item={selected}
          videoAnimation={videoAnimation}
          playheadMs={playheadMs}
          onUpdate={(patch, control) => onUpdate(selected.id, patch, control)}
          onRemove={() => onRemove(selected.id)}
        />
      )}
    </div>
  )
}

function TextInspector({
  item,
  videoAnimation,
  playheadMs,
  onUpdate,
  onRemove,
}: {
  item: TextItem
  videoAnimation: TextAnimation
  playheadMs: number
  onUpdate: (patch: Partial<TextItem>, control: string) => void
  onRemove: () => void
}) {
  // Typed text saves as you go (undo merges the keystrokes).
  const [text, setText] = useState(item.text)
  const animation = item.animation ?? videoAnimation
  const videoStyle = "video"

  return (
    <section
      className="flex flex-col gap-5 border-t pt-5"
      aria-labelledby="text-item-heading"
    >
      <h3 id="text-item-heading" className="text-sm font-medium">
        {textRoleLabels[item.role]} at {formatTimecode(item.atMs)}
      </h3>

      <Field>
        <FieldLabel htmlFor="text-item-text">Text</FieldLabel>
        <Textarea
          id="text-item-text"
          value={text}
          maxLength={textLimits.text}
          rows={2}
          aria-describedby="text-item-text-hint"
          onChange={(event) => {
            setText(event.target.value)
            if (event.target.value.trim()) {
              onUpdate({ text: event.target.value }, "text")
            }
          }}
        />
        <FieldDescription id="text-item-text-hint">
          {animation === "keyword-swap"
            ? "Put the words to roll through in braces: Ship {faster|safer|together}."
            : animation === "number-ticker"
              ? "Numbers count up, e.g. “Save 12 hours a week” or “$4,200 recovered”."
              : "Short lines read best: aim for 3–7 words."}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="text-item-emphasis">Highlight words</FieldLabel>
        <Input
          id="text-item-emphasis"
          value={item.emphasis}
          maxLength={textLimits.emphasis}
          placeholder="e.g. in one click"
          aria-describedby="text-item-emphasis-hint"
          onChange={(event) =>
            onUpdate({ emphasis: event.target.value }, "emphasis")
          }
        />
        <FieldDescription id="text-item-emphasis-hint">
          Shown in your accent colour (the marker sweep highlights them).
        </FieldDescription>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="text-item-role">Kind</FieldLabel>
          <Select
            items={textRoles.map((role) => ({
              value: role,
              label: textRoleLabels[role],
            }))}
            value={item.role}
            onValueChange={(value) =>
              value && onUpdate({ role: value as TextRole }, "role")
            }
          >
            <SelectTrigger id="text-item-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {textRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {textRoleLabels[role]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="text-item-animation">Animation</FieldLabel>
          <Select
            items={[
              {
                value: videoStyle,
                label: `Video style (${textAnimationLabels[videoAnimation].label})`,
              },
              ...textAnimations.map((a) => ({
                value: a,
                label: textAnimationLabels[a].label,
              })),
            ]}
            value={item.animation ?? videoStyle}
            onValueChange={(value) =>
              value &&
              onUpdate(
                {
                  animation:
                    value === videoStyle ? null : (value as TextAnimation),
                },
                "animation"
              )
            }
          >
            <SelectTrigger id="text-item-animation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={videoStyle}>
                  Video style ({textAnimationLabels[videoAnimation].label})
                </SelectItem>
                {textAnimations.map((a) => (
                  <SelectItem key={a} value={a}>
                    {textAnimationLabels[a].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field>
        <span className="text-sm font-medium" id="text-item-place">
          Place
        </span>
        <div
          className="grid w-36 grid-cols-3 gap-1"
          role="group"
          aria-labelledby="text-item-place"
        >
          {spots.map((spot) => {
            const isHere =
              Math.abs(item.x - spot.x) < 0.01 &&
              Math.abs(item.y - spot.y) < 0.01
            return (
              <button
                key={spot.label}
                type="button"
                aria-label={spot.label}
                aria-pressed={isHere}
                onClick={() =>
                  onUpdate({ x: spot.x, y: spot.y, align: spot.align }, "place")
                }
                className={cn(
                  "flex h-8 items-center justify-center rounded-md border bg-background outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  isHere && "border-ring bg-secondary ring-2 ring-ring/40"
                )}
              >
                <AlignCenterIcon aria-hidden className="size-3.5 opacity-60" />
              </button>
            )
          })}
        </div>
      </Field>

      <LayerControl
        track={item.track}
        onChange={(track) => onUpdate({ track }, "track")}
      />

      <SliderField
        label="On screen for"
        value={item.durationMs}
        min={600}
        max={10_000}
        step={100}
        format={(ms) => `${(ms / 1000).toFixed(1)} s`}
        onChange={(durationMs) => onUpdate({ durationMs }, "duration")}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={Math.abs(playheadMs - item.atMs) < 50}
          onClick={() => onUpdate({ atMs: Math.round(playheadMs) }, "time")}
        >
          <ClockIcon data-icon="inline-start" />
          Start at {formatTimecode(playheadMs)}
        </Button>
        <Button type="button" variant="ghost" onClick={onRemove}>
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      </div>
    </section>
  )
}
