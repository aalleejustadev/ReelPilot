"use client"

import { CrosshairIcon, SparklesIcon, TrashIcon, VideoIcon } from "lucide-react"
import { useState } from "react"

import { cn } from "@/shared/lib/utils"
import {
  cameraLimits,
  defaultShot,
  easingNames,
  introKinds,
  introLabels,
  presetOf,
  shotPresetNames,
  shotPresets,
  type CameraSettings,
  type EasingName,
  type IntroKind,
  type Presentation,
  type Shot,
  type ShotPresetName,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { Textarea } from "@/shared/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import { formatTimecode } from "../lib/format"
import { motionPrompts } from "../lib/motion-prompts"

export type InspectorTab = "shot" | "style" | "ai"

const easingLabels: Record<EasingName, string> = {
  smooth: "Smooth",
  snappy: "Snappy",
  linear: "Linear",
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel id={id}>{label}</FieldLabel>
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

function ShotPanel({
  moment,
  shot,
  pickingFocus,
  onShotChange,
  onTogglePick,
}: {
  moment: { atMs: number; label: string | null } | null
  shot: Shot | null
  pickingFocus: boolean
  onShotChange: (shot: Shot | null) => void
  onTogglePick: () => void
}) {
  if (!moment) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a key moment on the timeline to set the camera for it.
      </p>
    )
  }
  const current = shot ?? defaultShot
  const setCamera = (camera: Partial<CameraSettings>) =>
    onShotChange({ ...current, camera: { ...current.camera, ...camera } })
  const preset = shot ? presetOf(shot.camera) : undefined

  return (
    <FieldGroup className="gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          Shot at{" "}
          <span className="font-mono">{formatTimecode(moment.atMs)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {shot
            ? (moment.label ?? "The camera moves here at this moment.")
            : "No shot yet: the camera keeps the previous one. Pick a shot to start."}
        </p>
      </div>

      <Field>
        <FieldLabel>Shot</FieldLabel>
        <ToggleGroup
          aria-label="Shot preset"
          variant="outline"
          className="grid grid-cols-2 gap-2"
          value={preset ? [preset] : []}
          onValueChange={(values) => {
            const name = values[0] as ShotPresetName | undefined
            if (name) {
              onShotChange({ ...current, camera: shotPresets[name].camera })
            }
          }}
        >
          {shotPresetNames.map((name) => (
            <ToggleGroupItem key={name} value={name} className="w-full">
              {shotPresets[name].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {shot && (
        <>
          <SliderField
            id="shot-tilt"
            label="Tilt"
            value={current.camera.tilt}
            {...cameraLimits.tilt}
            step={1}
            format={degrees}
            onChange={(tilt) => setCamera({ tilt })}
          />
          <SliderField
            id="shot-turn"
            label="Turn"
            value={current.camera.turn}
            {...cameraLimits.turn}
            step={1}
            format={degrees}
            onChange={(turn) => setCamera({ turn })}
          />
          <SliderField
            id="shot-roll"
            label="Roll"
            value={current.camera.roll}
            {...cameraLimits.roll}
            step={1}
            format={degrees}
            onChange={(roll) => setCamera({ roll })}
          />
          <SliderField
            id="shot-zoom"
            label="Zoom"
            value={current.camera.zoom}
            {...cameraLimits.zoom}
            step={0.05}
            format={(value) => `${value.toFixed(2)}×`}
            onChange={(zoom) => setCamera({ zoom })}
          />

          <Field>
            <FieldLabel>Focus point</FieldLabel>
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
              Zoom and turns pivot on this point.
            </FieldDescription>
          </Field>

          <SliderField
            id="shot-transition"
            label="Move takes"
            value={current.transitionMs}
            min={0}
            max={3000}
            step={100}
            format={(ms) => (ms === 0 ? "Cut" : `${(ms / 1000).toFixed(1)} s`)}
            onChange={(transitionMs) =>
              onShotChange({ ...current, transitionMs })
            }
          />
          <Field>
            <FieldLabel>Easing</FieldLabel>
            <ToggleGroup
              aria-label="Easing"
              variant="outline"
              className="grid grid-cols-3 gap-2"
              value={[current.easing]}
              onValueChange={(values) => {
                const easing = values[0] as EasingName | undefined
                if (easing) onShotChange({ ...current, easing })
              }}
            >
              {easingNames.map((name) => (
                <ToggleGroupItem key={name} value={name} className="w-full">
                  {easingLabels[name]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onShotChange(null)}
            >
              <TrashIcon data-icon="inline-start" />
              Remove shot
            </Button>
          </div>
        </>
      )}
    </FieldGroup>
  )
}

function ColorPicker({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string
  value: string
  swatches: string[]
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
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
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Use brand colour ${swatch}`}
            aria-pressed={swatch === value}
            className={cn(
              "size-7 rounded-full border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              swatch === value && "ring-2 ring-ring"
            )}
            style={{ backgroundColor: swatch }}
            onClick={() => onChange(swatch)}
          />
        ))}
      </div>
    </Field>
  )
}

function StylePanel({
  presentation,
  brandColors,
  onChange,
}: {
  presentation: Presentation
  brandColors: string[]
  onChange: (presentation: Presentation) => void
}) {
  const { background, frame, intro } = presentation
  const set = <K extends keyof Presentation>(key: K, value: Presentation[K]) =>
    onChange({ ...presentation, [key]: value })

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Background</FieldLabel>
        <ToggleGroup
          aria-label="Background style"
          variant="outline"
          className="grid grid-cols-2 gap-2"
          value={[background.kind]}
          onValueChange={(values) => {
            const kind = values[0] as "solid" | "gradient" | undefined
            if (kind) set("background", { ...background, kind })
          }}
        >
          <ToggleGroupItem value="gradient" className="w-full">
            Gradient
          </ToggleGroupItem>
          <ToggleGroupItem value="solid" className="w-full">
            Solid
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <ColorPicker
        label={background.kind === "gradient" ? "Start colour" : "Colour"}
        value={background.from}
        swatches={brandColors}
        onChange={(from) => set("background", { ...background, from })}
      />
      {background.kind === "gradient" && (
        <ColorPicker
          label="End colour"
          value={background.to}
          swatches={brandColors}
          onChange={(to) => set("background", { ...background, to })}
        />
      )}
      <SliderField
        id="frame-radius"
        label="Rounded corners"
        value={frame.radius}
        min={0}
        max={8}
        step={0.5}
        format={(value) => `${value}%`}
        onChange={(radius) => set("frame", { ...frame, radius })}
      />
      <SliderField
        id="frame-padding"
        label="Space around"
        value={frame.padding}
        min={0}
        max={0.3}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(padding) => set("frame", { ...frame, padding })}
      />
      <Field orientation="horizontal">
        <Switch
          id="frame-shadow"
          checked={frame.shadow}
          onCheckedChange={(shadow) => set("frame", { ...frame, shadow })}
        />
        <FieldLabel htmlFor="frame-shadow">Shadow under the screen</FieldLabel>
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
            if (kind) set("intro", { ...intro, kind: kind as IntroKind })
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
          id="intro-duration"
          label="Intro length"
          value={intro.durationMs}
          min={300}
          max={3000}
          step={100}
          format={(ms) => `${(ms / 1000).toFixed(1)} s`}
          onChange={(durationMs) => set("intro", { ...intro, durationMs })}
        />
      )}
    </FieldGroup>
  )
}

function DirectPanel({
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
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (instruction.trim()) onDirect(instruction)
      }}
    >
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
        />
        <FieldDescription>
          {hasMoments
            ? "The AI sets a shot for every key moment and picks an intro. You can fine-tune them after."
            : "Add a key moment first: the AI directs the camera at each one."}
        </FieldDescription>
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

/** Right-hand controls: the selected moment's shot, the clip's style, AI. */
export function MotionInspector({
  tab,
  onTabChange,
  moment,
  shot,
  presentation,
  brandColors,
  pickingFocus,
  hasMoments,
  isDirecting,
  saveState,
  onShotChange,
  onPresentationChange,
  onTogglePick,
  onDirect,
}: {
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  moment: { atMs: number; label: string | null } | null
  shot: Shot | null
  presentation: Presentation
  brandColors: string[]
  pickingFocus: boolean
  hasMoments: boolean
  isDirecting: boolean
  saveState: "saved" | "saving" | "failed"
  onShotChange: (shot: Shot | null) => void
  onPresentationChange: (presentation: Presentation) => void
  onTogglePick: () => void
  onDirect: (instruction: string) => void
}) {
  return (
    <aside
      aria-label="Motion controls"
      className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:sticky lg:top-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium">
          <VideoIcon aria-hidden className="size-4" />
          Camera &amp; style
        </h3>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "failed"
              ? "Not saved"
              : "Saved"}
        </span>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as InspectorTab)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="shot">Shot</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="shot" className="pt-4">
          <ShotPanel
            moment={moment}
            shot={shot}
            pickingFocus={pickingFocus}
            onShotChange={onShotChange}
            onTogglePick={onTogglePick}
          />
        </TabsContent>
        <TabsContent value="style" className="pt-4">
          <StylePanel
            presentation={presentation}
            brandColors={brandColors}
            onChange={onPresentationChange}
          />
        </TabsContent>
        <TabsContent value="ai" className="pt-4">
          <DirectPanel
            hasMoments={hasMoments}
            isDirecting={isDirecting}
            onDirect={onDirect}
          />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
