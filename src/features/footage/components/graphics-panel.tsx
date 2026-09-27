"use client"

import {
  AwardIcon,
  CircleDashedIcon,
  ClockIcon,
  CrosshairIcon,
  EyeOffIcon,
  FlagIcon,
  KeyboardIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  PanelBottomIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  Trash2Icon,
  TrendingUpIcon,
  UnderlineIcon,
} from "lucide-react"
import { useTransition } from "react"

import { cn } from "@/shared/lib/utils"
import {
  graphicInfo,
  graphicKinds,
  graphicLimits,
  isScreenGraphic,
  type GraphicItem,
  type GraphicKind,
} from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { Field, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import { formatTimecode } from "../lib/format"
import {
  graphicTemplates,
  type GraphicTemplateId,
} from "../lib/graphic-templates"
import { PanelHeading, SliderField } from "./editor-panels"

const icons: Record<
  GraphicKind,
  React.ComponentType<{ className?: string }>
> = {
  ripple: MousePointerClickIcon,
  spotlight: SunIcon,
  magnifier: SearchIcon,
  callout: MessageSquareIcon,
  circle: CircleDashedIcon,
  underline: UnderlineIcon,
  privacy: EyeOffIcon,
  keys: KeyboardIcon,
  stat: TrendingUpIcon,
  "lower-third": PanelBottomIcon,
  logo: AwardIcon,
  "end-card": FlagIcon,
}

/** Motion graphics (§7.4b F): per-moment templates, a gallery, and settings. */
export function GraphicsPanel({
  items,
  selectedId,
  playheadMs,
  moment,
  templates,
  isPicking,
  onApplyTemplate,
  onAskAi,
  onAdd,
  onSelect,
  onUpdate,
  onRemove,
  onTogglePick,
}: {
  items: GraphicItem[]
  selectedId: string | null
  playheadMs: number
  /** The selected key moment, if any. */
  moment: { atMs: number; hasInsight: boolean } | null
  templates: GraphicTemplateId[]
  isPicking: boolean
  onApplyTemplate: (template: GraphicTemplateId) => void
  onAskAi: () => Promise<void>
  onAdd: (kind: GraphicKind) => void
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<GraphicItem>, control: string) => void
  onRemove: (id: string) => void
  onTogglePick: () => void
}) {
  const [isAsking, startAsk] = useTransition()
  const selected = items.find((item) => item.id === selectedId) ?? null
  const full = items.length >= graphicLimits.items
  const ordered = [...items].sort((a, b) => a.atMs - b.atMs)

  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Graphics"
        description="Callouts, spotlights and lenses pinned to what's on screen; cards and end screens over the stage."
      />

      {moment && (
        <section
          className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
          aria-labelledby="moment-graphic-heading"
        >
          <h3 id="moment-graphic-heading" className="text-sm font-medium">
            Make the moment at {formatTimecode(moment.atMs)} a graphic
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                disabled={full}
                onClick={() => onApplyTemplate(template)}
                className="flex flex-col gap-0.5 rounded-lg border bg-background p-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <span className="text-sm font-medium">
                  {graphicTemplates[template].title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {graphicTemplates[template].hint}
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isAsking || full}
            onClick={() => startAsk(onAskAi)}
          >
            {isAsking ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            Let AI choose
          </Button>
          {!moment.hasInsight && (
            <p className="text-xs text-muted-foreground">
              Tip: the AI chooses better once the footage is analysed (Moments
              tab).
            </p>
          )}
        </section>
      )}

      {(["On the screen", "On the stage"] as const).map((group) => (
        <section key={group} className="flex flex-col gap-2" aria-label={group}>
          <h3 className="text-sm font-medium">
            {group === "On the screen"
              ? "Add on the screen"
              : "Add on the stage"}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {graphicKinds
              .filter(
                (kind) => isScreenGraphic(kind) === (group === "On the screen")
              )
              .map((kind) => {
                const Icon = icons[kind]
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={full}
                    onClick={() => onAdd(kind)}
                    className="flex items-start gap-2 rounded-lg border bg-background p-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {graphicInfo[kind].label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {graphicInfo[kind].hint}
                      </span>
                    </span>
                  </button>
                )
              })}
          </div>
        </section>
      ))}

      {ordered.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Graphics on the ad">
          {ordered.map((item) => {
            const Icon = icons[item.kind]
            return (
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
                  <Icon className="size-4 shrink-0" />
                  <span className="font-mono text-xs">
                    {formatTimecode(item.atMs)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {graphicInfo[item.kind].label}
                    {item.text ? ` · ${item.text}` : ""}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selected && (
        <GraphicInspector
          key={selected.id}
          item={selected}
          playheadMs={playheadMs}
          isPicking={isPicking}
          onUpdate={(patch, control) => onUpdate(selected.id, patch, control)}
          onRemove={() => onRemove(selected.id)}
          onTogglePick={onTogglePick}
        />
      )}
    </div>
  )
}

function GraphicInspector({
  item,
  playheadMs,
  isPicking,
  onUpdate,
  onRemove,
  onTogglePick,
}: {
  item: GraphicItem
  playheadMs: number
  isPicking: boolean
  onUpdate: (patch: Partial<GraphicItem>, control: string) => void
  onRemove: () => void
  onTogglePick: () => void
}) {
  const info = graphicInfo[item.kind]
  const onScreen = isScreenGraphic(item.kind)
  return (
    <section
      className="flex flex-col gap-5 border-t pt-5"
      aria-labelledby="graphic-heading"
    >
      <h3 id="graphic-heading" className="text-sm font-medium">
        {info.label} at {formatTimecode(item.atMs)}
      </h3>

      {info.text && (
        <Field>
          <FieldLabel htmlFor="graphic-text">{info.text}</FieldLabel>
          <Input
            id="graphic-text"
            value={item.text}
            maxLength={graphicLimits.text}
            placeholder={
              item.kind === "keys"
                ? "⌘ K"
                : item.kind === "stat"
                  ? "12 hours"
                  : item.kind === "end-card"
                    ? "Try it free today"
                    : ""
            }
            onChange={(event) => onUpdate({ text: event.target.value }, "text")}
          />
        </Field>
      )}
      {info.secondary && (
        <Field>
          <FieldLabel htmlFor="graphic-secondary">{info.secondary}</FieldLabel>
          <Input
            id="graphic-secondary"
            value={item.secondary}
            maxLength={graphicLimits.text}
            placeholder={item.kind === "end-card" ? "Get started" : ""}
            onChange={(event) =>
              onUpdate({ secondary: event.target.value }, "secondary")
            }
          />
        </Field>
      )}

      {onScreen && (
        <>
          <Field>
            <span className="text-sm font-medium">On the screen</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {Math.round((item.box.x + item.box.w / 2) * 100)}% ×{" "}
                {Math.round((item.box.y + item.box.h / 2) * 100)}%
              </span>
              <Button
                type="button"
                variant={isPicking ? "default" : "outline"}
                aria-pressed={isPicking}
                onClick={onTogglePick}
              >
                <CrosshairIcon data-icon="inline-start" />
                {isPicking ? "Click the video" : "Place on video"}
              </Button>
            </div>
          </Field>
          <SliderField
            label="Size"
            value={item.box.w}
            min={0.04}
            max={0.8}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(w) => {
              // Keep the same centre and shape.
              const ratio = item.box.h / item.box.w
              const cx = item.box.x + item.box.w / 2
              const cy = item.box.y + item.box.h / 2
              const h = Math.min(1, w * ratio)
              onUpdate(
                {
                  box: {
                    x: Math.min(1 - w, Math.max(0, cx - w / 2)),
                    y: Math.min(1 - h, Math.max(0, cy - h / 2)),
                    w,
                    h,
                  },
                },
                "size"
              )
            }}
          />
        </>
      )}

      {item.kind === "callout" && (
        <Field>
          <span className="text-sm font-medium">Label side</span>
          <ToggleGroup
            aria-label="Label side"
            variant="outline"
            className="grid grid-cols-5 gap-1"
            value={[item.side]}
            onValueChange={(values) => {
              const side = values[0] as GraphicItem["side"] | undefined
              if (side) onUpdate({ side }, "side")
            }}
          >
            {(["auto", "left", "right", "top", "bottom"] as const).map(
              (side) => (
                <ToggleGroupItem
                  key={side}
                  value={side}
                  className="w-full px-0 text-xs capitalize"
                >
                  {side}
                </ToggleGroupItem>
              )
            )}
          </ToggleGroup>
        </Field>
      )}

      <SliderField
        label="On screen for"
        value={item.durationMs}
        min={400}
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
