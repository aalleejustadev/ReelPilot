"use client"

import {
  CopyIcon,
  CrosshairIcon,
  RotateCcwIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react"
import { useState } from "react"

import { cn } from "@/shared/lib/utils"
import {
  backgroundStyle,
  cameraLimits,
  cameraStyle,
  defaultShot,
  easingNames,
  introKinds,
  introLabels,
  presetOf,
  shotPresetGroups,
  shotPresets,
  type CameraSettings,
  type EasingName,
  type IntroKind,
  type Presentation,
  type Shot,
} from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Slider } from "@/shared/ui/slider"
import { Spinner } from "@/shared/ui/spinner"
import { Switch } from "@/shared/ui/switch"
import { Textarea } from "@/shared/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import { formatTimecode } from "../lib/format"
import { backgroundPresets, looks } from "../lib/looks"
import { motionPrompts } from "../lib/motion-prompts"

/** Every panel opens with a title and a short line on what it does. */
export function PanelHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <Field className="gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">
          {format(value)}
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => {
          const number = Array.isArray(next) ? next[0] : next
          if (typeof number === "number") onChange(number)
        }}
      />
    </Field>
  )
}

const degrees = (value: number) => `${Math.round(value)}°`

/** A tiny 3D card showing what a shot looks like. */
function ShotThumb({ camera }: { camera: CameraSettings }) {
  // Zoom is shown gently: a thumbnail can't show a 2× close-up.
  const pose = { ...camera, zoom: 1 + (camera.zoom - 1) * 0.35, x: 0, y: 0 }
  return (
    <span
      aria-hidden
      className="flex h-14 w-full items-center justify-center overflow-hidden rounded-md bg-muted"
      style={{ perspective: "260px" }}
    >
      <span
        className="block h-7 w-11 rounded-[3px] bg-foreground/80 shadow-md ring-1 ring-background/40"
        style={cameraStyle(pose)}
      />
    </span>
  )
}

// ── Effects ────────────────────────────────────────────────────────────────

export function EffectsPanel({
  hasMoments,
  brandColors,
  onApplyLook,
  onReset,
  onBackground,
}: {
  hasMoments: boolean
  brandColors: string[]
  onApplyLook: (lookId: string) => void
  onReset: () => void
  onBackground: (background: Presentation["background"]) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Effects"
        description="One click styles the whole clip. Undo with ⌘Z if you don’t like it."
      />
      <section className="flex flex-col gap-3" aria-labelledby="looks-heading">
        <h3 id="looks-heading" className="text-sm font-medium">
          Looks
        </h3>
        {!hasMoments && (
          <p className="text-sm text-muted-foreground">
            Add a key moment first: looks set a shot at each one.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {looks.map((look) => (
            <button
              key={look.id}
              type="button"
              disabled={!hasMoments}
              onClick={() => onApplyLook(look.id)}
              className="flex flex-col gap-2 rounded-lg border bg-background p-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <ShotThumb
                camera={shotPresets[look.sequence[0] ?? "flat"].camera}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{look.title}</span>
                <span className="text-xs text-muted-foreground">
                  {look.description}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div>
          <Button type="button" variant="ghost" onClick={onReset}>
            <RotateCcwIcon data-icon="inline-start" />
            Reset to flat
          </Button>
        </div>
      </section>
      <section
        className="flex flex-col gap-3"
        aria-labelledby="backgrounds-heading"
      >
        <h3 id="backgrounds-heading" className="text-sm font-medium">
          Backgrounds
        </h3>
        <BackgroundPresets brandColors={brandColors} onPick={onBackground} />
      </section>
    </div>
  )
}

function BackgroundPresets({
  brandColors,
  current,
  onPick,
}: {
  brandColors: string[]
  current?: Presentation["background"]
  onPick: (background: Presentation["background"]) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {backgroundPresets(brandColors).map(({ name, background }) => {
        const isCurrent =
          current?.kind === background.kind &&
          current.from === background.from &&
          current.to === background.to
        return (
          <button
            key={name}
            type="button"
            aria-pressed={isCurrent}
            onClick={() => onPick(background)}
            className="flex flex-col items-center gap-1 rounded-md p-1 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              aria-hidden
              className={cn(
                "h-8 w-full rounded-md border",
                isCurrent && "ring-2 ring-ring"
              )}
              style={{ background: backgroundStyle(background) }}
            />
            {name}
          </button>
        )
      })}
    </div>
  )
}

// ── Shot ───────────────────────────────────────────────────────────────────

const easingLabels: Record<EasingName, string> = {
  smooth: "Smooth",
  snappy: "Snappy",
  linear: "Linear",
}

export function ShotPanel({
  moment,
  shot,
  pickingFocus,
  onShotChange,
  onTogglePick,
  onApplyToAll,
}: {
  moment: { atMs: number; label: string | null } | null
  shot: Shot | null
  pickingFocus: boolean
  onShotChange: (shot: Shot | null, control: string) => void
  onTogglePick: () => void
  onApplyToAll: () => void
}) {
  if (!moment) {
    return (
      <PanelHeading
        title="Shot"
        description="Select a key moment on the timeline to set the camera for it."
      />
    )
  }
  const current = shot ?? defaultShot
  const setCamera = (camera: Partial<CameraSettings>, control: string) =>
    onShotChange(
      { ...current, camera: { ...current.camera, ...camera } },
      control
    )
  const preset = shot ? presetOf(shot.camera) : undefined

  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title={`Shot at ${formatTimecode(moment.atMs)}`}
        description={
          shot
            ? (moment.label ?? "The camera moves here at this moment.")
            : "No shot yet: the camera keeps the previous one. Pick one below."
        }
      />

      {shotPresetGroups.map((group) => (
        <section
          key={group.label}
          className="flex flex-col gap-2"
          aria-label={`${group.label} shots`}
        >
          <h3 className="text-xs font-medium text-muted-foreground">
            {group.label}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {group.presets.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={preset === name}
                onClick={() =>
                  onShotChange(
                    { ...current, camera: shotPresets[name].camera },
                    "preset"
                  )
                }
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border bg-background p-1.5 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  preset === name && "border-ring ring-2 ring-ring/40"
                )}
              >
                <ShotThumb camera={shotPresets[name].camera} />
                <span className="line-clamp-2 min-h-8 text-center leading-4">
                  {shotPresets[name].label}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {shot && (
        <FieldGroup className="gap-5">
          <h3 className="text-sm font-medium">
            Customise {preset ? shotPresets[preset].label : "this shot"}
          </h3>
          <SliderField
            label="Tilt"
            value={current.camera.tilt}
            {...cameraLimits.tilt}
            step={1}
            format={degrees}
            onChange={(tilt) => setCamera({ tilt }, "tilt")}
          />
          <SliderField
            label="Turn"
            value={current.camera.turn}
            {...cameraLimits.turn}
            step={1}
            format={degrees}
            onChange={(turn) => setCamera({ turn }, "turn")}
          />
          <SliderField
            label="Roll"
            value={current.camera.roll}
            {...cameraLimits.roll}
            step={1}
            format={degrees}
            onChange={(roll) => setCamera({ roll }, "roll")}
          />
          <SliderField
            label="Zoom"
            value={current.camera.zoom}
            {...cameraLimits.zoom}
            step={0.05}
            format={(value) => `${value.toFixed(2)}×`}
            onChange={(zoom) => setCamera({ zoom }, "zoom")}
          />
          <SliderField
            label="Drift"
            value={current.drift}
            min={0}
            max={1}
            step={0.05}
            format={(value) =>
              value === 0 ? "Still" : `${Math.round(value * 100)}%`
            }
            onChange={(drift) => onShotChange({ ...current, drift }, "drift")}
          />
          <Field>
            <span className="text-sm font-medium">Focus point</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {Math.round(current.camera.focusX * 100)}% ×{" "}
                {Math.round(current.camera.focusY * 100)}%
              </span>
              <Button
                type="button"
                variant={pickingFocus ? "default" : "outline"}
                aria-pressed={pickingFocus}
                onClick={onTogglePick}
              >
                <CrosshairIcon data-icon="inline-start" />
                {pickingFocus ? "Click the video" : "Pick on video"}
              </Button>
            </div>
            <FieldDescription>
              Zoom and turns pivot on this point. Drift slowly pushes in while
              the shot holds.
            </FieldDescription>
          </Field>
          <SliderField
            label="Move takes"
            value={current.transitionMs}
            min={0}
            max={3000}
            step={100}
            format={(ms) => (ms === 0 ? "Cut" : `${(ms / 1000).toFixed(1)} s`)}
            onChange={(transitionMs) =>
              onShotChange({ ...current, transitionMs }, "transition")
            }
          />
          <Field>
            <span className="text-sm font-medium">Easing</span>
            <ToggleGroup
              aria-label="Easing"
              variant="outline"
              className="grid grid-cols-3 gap-2"
              value={[current.easing]}
              onValueChange={(values) => {
                const easing = values[0] as EasingName | undefined
                if (easing) onShotChange({ ...current, easing }, "easing")
              }}
            >
              {easingNames.map((name) => (
                <ToggleGroupItem key={name} value={name} className="w-full">
                  {easingLabels[name]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onApplyToAll}>
              <CopyIcon data-icon="inline-start" />
              Use on every moment
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onShotChange(null, "remove")}
            >
              <TrashIcon data-icon="inline-start" />
              Remove shot
            </Button>
          </div>
        </FieldGroup>
      )}
    </div>
  )
}

// ── Style ──────────────────────────────────────────────────────────────────

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Native picker over a swatch (as in the brand kit editor). */}
      <span className="relative size-9 shrink-0">
        <input
          type="color"
          aria-label={`Pick ${label.toLowerCase()}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md border peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
          style={{ backgroundColor: value }}
        />
      </span>
      <span className="text-sm">{label}</span>
      <span className="ml-auto font-mono text-sm text-muted-foreground">
        {value}
      </span>
    </div>
  )
}

export function StylePanel({
  presentation,
  brandColors,
  onChange,
}: {
  presentation: Presentation
  brandColors: string[]
  onChange: (presentation: Presentation, control: string) => void
}) {
  const { background, frame, intro } = presentation
  const set = <K extends keyof Presentation>(
    key: K,
    value: Presentation[K],
    control: string
  ) => onChange({ ...presentation, [key]: value }, control)

  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Style"
        description="The stage around your screen: background, frame and intro."
      />
      <BackgroundPresets
        brandColors={brandColors}
        current={background}
        onPick={(next) => set("background", next, "background-preset")}
      />
      <FieldGroup className="gap-5">
        <Field>
          <span className="text-sm font-medium">Background</span>
          <ToggleGroup
            aria-label="Background style"
            variant="outline"
            className="grid grid-cols-2 gap-2"
            value={[background.kind]}
            onValueChange={(values) => {
              const kind = values[0] as "solid" | "gradient" | undefined
              if (kind)
                set("background", { ...background, kind }, "background-kind")
            }}
          >
            <ToggleGroupItem value="gradient" className="w-full">
              Gradient
            </ToggleGroupItem>
            <ToggleGroupItem value="solid" className="w-full">
              Solid
            </ToggleGroupItem>
          </ToggleGroup>
          <ColorPicker
            label={background.kind === "gradient" ? "Start colour" : "Colour"}
            value={background.from}
            onChange={(from) =>
              set("background", { ...background, from }, "from")
            }
          />
          {background.kind === "gradient" && (
            <ColorPicker
              label="End colour"
              value={background.to}
              onChange={(to) => set("background", { ...background, to }, "to")}
            />
          )}
        </Field>
        <SliderField
          label="Rounded corners"
          value={frame.radius}
          min={0}
          max={8}
          step={0.5}
          format={(value) => `${value}%`}
          onChange={(radius) => set("frame", { ...frame, radius }, "radius")}
        />
        <SliderField
          label="Space around"
          value={frame.padding}
          min={0}
          max={0.3}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(padding) => set("frame", { ...frame, padding }, "padding")}
        />
        <Field orientation="horizontal">
          <Switch
            id="frame-shadow"
            checked={frame.shadow}
            onCheckedChange={(shadow) =>
              set("frame", { ...frame, shadow }, "shadow")
            }
          />
          <FieldLabel htmlFor="frame-shadow">
            Shadow under the screen
          </FieldLabel>
        </Field>
        <Field>
          <FieldLabel htmlFor="intro-kind">Intro</FieldLabel>
          <Select
            items={introKinds.map((kind) => ({
              value: kind,
              label: introLabels[kind],
            }))}
            value={intro.kind}
            onValueChange={(kind) => {
              if (kind)
                set("intro", { ...intro, kind: kind as IntroKind }, "intro")
            }}
          >
            <SelectTrigger id="intro-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {introKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {introLabels[kind]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {intro.kind !== "none" && (
          <SliderField
            label="Intro length"
            value={intro.durationMs}
            min={300}
            max={3000}
            step={100}
            format={(ms) => `${(ms / 1000).toFixed(1)} s`}
            onChange={(durationMs) =>
              set("intro", { ...intro, durationMs }, "intro-length")
            }
          />
        )}
      </FieldGroup>
    </div>
  )
}

// ── AI ─────────────────────────────────────────────────────────────────────

export function DirectPanel({
  hasMoments,
  isDirecting,
  onDirect,
}: {
  hasMoments: boolean
  isDirecting: boolean
  onDirect: (instruction: string) => void
}) {
  const [instruction, setInstruction] = useState("")
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (instruction.trim()) onDirect(instruction)
      }}
    >
      <PanelHeading
        title="Direct with AI"
        description={
          hasMoments
            ? "Say how it should feel. The AI sets a shot for every key moment and an intro; fine-tune after."
            : "Add a key moment first: the AI directs the camera at each one."
        }
      />
      <Field>
        <FieldLabel id="motion-prompts-label">Start from a prompt</FieldLabel>
        <div
          role="group"
          aria-labelledby="motion-prompts-label"
          className="flex flex-wrap gap-2"
        >
          {motionPrompts.map((prompt) => (
            <Button
              key={prompt.title}
              type="button"
              size="sm"
              variant={instruction === prompt.text ? "secondary" : "outline"}
              aria-pressed={instruction === prompt.text}
              disabled={isDirecting}
              title={prompt.text}
              onClick={() => setInstruction(prompt.text)}
            >
              {prompt.title}
            </Button>
          ))}
        </div>
      </Field>
      <Field>
        <FieldLabel htmlFor="motion-instruction">
          Describe the motion
        </FieldLabel>
        <Textarea
          id="motion-instruction"
          placeholder="Fly in from the left, then zoom into each feature. Keep it calm and readable."
          value={instruction}
          maxLength={500}
          onChange={(event) => setInstruction(event.target.value)}
          disabled={isDirecting}
          className="min-h-28"
        />
      </Field>
      <Button
        type="submit"
        disabled={!hasMoments || isDirecting || !instruction.trim()}
      >
        {isDirecting ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <SparklesIcon data-icon="inline-start" />
        )}
        Direct with AI
      </Button>
    </form>
  )
}
