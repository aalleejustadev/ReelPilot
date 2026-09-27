"use client"

import { cn } from "@/shared/lib/utils"
import { blurEdges, fStops, type BlurEdge, type Lens } from "@/shared/motion"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/shared/ui/field"
import { Switch } from "@/shared/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import { lensLooks } from "../lib/lens-looks"
import { PanelHeading, SliderField } from "./editor-panels"

const edgeLabels: Record<BlurEdge, string> = {
  top: "Top",
  bottom: "Bottom",
  both: "Top & bottom",
  left: "Left",
  right: "Right",
  edges: "All edges",
}

const sameLens = (a: Lens, b: Lens) => JSON.stringify(a) === JSON.stringify(b)

/** Lens effects: depth of field and progressive blur, like a real camera. */
export function LensPanel({
  lens,
  motionBlur,
  shotIsFlat,
  onChange,
  onMotionBlur,
}: {
  lens: Lens
  motionBlur: boolean
  /** The camera faces the screen here: depth of field has nothing to blur. */
  shotIsFlat: boolean
  onChange: (lens: Lens, control: string) => void
  onMotionBlur: (motionBlur: boolean) => void
}) {
  const dof = lens.depthOfField
  const edge = lens.progressiveBlur
  const setDof = (patch: Partial<Lens["depthOfField"]>, control: string) =>
    onChange({ ...lens, depthOfField: { ...dof, ...patch } }, `dof:${control}`)
  const setEdge = (patch: Partial<Lens["progressiveBlur"]>, control: string) =>
    onChange(
      { ...lens, progressiveBlur: { ...edge, ...patch } },
      `edge:${control}`
    )

  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Lens"
        description="Real camera effects. Depth of field blurs what's nearer or farther than the focus point; progressive blur softens the edges. To keep one area sharp, add a Focus area (Graphics)."
      />

      <div className="grid grid-cols-2 gap-2">
        {lensLooks.map((look) => {
          const isCurrent = sameLens(look.lens, lens)
          return (
            <button
              key={look.id}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => onChange(look.lens, `look:${look.id}`)}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border bg-background p-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                isCurrent && "border-ring ring-2 ring-ring/40"
              )}
            >
              <span className="text-sm font-medium">{look.title}</span>
              <span className="text-xs text-muted-foreground">{look.hint}</span>
            </button>
          )
        })}
      </div>

      <Field orientation="horizontal">
        <Switch
          id="motion-blur"
          aria-describedby="motion-blur-hint"
          checked={motionBlur}
          onCheckedChange={onMotionBlur}
        />
        <FieldContent>
          <FieldLabel htmlFor="motion-blur">Motion blur</FieldLabel>
          <FieldDescription id="motion-blur-hint">
            A touch of blur on fast camera moves, like a real camera shutter.
          </FieldDescription>
        </FieldContent>
      </Field>

      <section className="flex flex-col gap-4" aria-labelledby="dof-heading">
        <Field orientation="horizontal">
          <Switch
            id="dof-on"
            checked={dof.enabled}
            aria-describedby="dof-hint"
            onCheckedChange={(enabled) => setDof({ enabled }, "on")}
          />
          <FieldContent>
            <FieldLabel htmlFor="dof-on" id="dof-heading">
              Depth of field
            </FieldLabel>
            <FieldDescription id="dof-hint">
              A band around the camera’s focus point stays sharp. On angled
              shots the parts leaning away or toward you soften gradually; a
              screen facing the camera is all in focus, as with a real lens.
            </FieldDescription>
          </FieldContent>
        </Field>
        {dof.enabled && (
          <>
            <Field>
              <span className="text-sm font-medium">Aperture</span>
              <ToggleGroup
                aria-label="Aperture"
                variant="outline"
                className="grid grid-cols-6 gap-1"
                value={[String(dof.fStop)]}
                onValueChange={(values) => {
                  const fStop = Number(values[0])
                  if (fStop) setDof({ fStop }, "f-stop")
                }}
              >
                {fStops.map((stop) => (
                  <ToggleGroupItem
                    key={stop}
                    value={String(stop)}
                    aria-label={`f/${stop}`}
                    className="w-full px-0 font-mono text-xs"
                  >
                    f/{stop}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                Smaller numbers open the lens: a thinner sharp zone around the
                focus point and softer surroundings.
              </FieldDescription>
            </Field>
            <SliderField
              label="Most blur"
              value={dof.maxBlur}
              min={0.2}
              max={3}
              step={0.1}
              format={(value) => `${value.toFixed(1)}%`}
              onChange={(maxBlur) => setDof({ maxBlur }, "max")}
            />
            {shotIsFlat && (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                The camera faces the screen here, so it’s all in focus. Pick an
                angled shot (or a look) to see the depth.
              </p>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="edge-heading">
        <Field orientation="horizontal">
          <Switch
            id="edge-on"
            checked={edge.enabled}
            aria-describedby="edge-hint"
            onCheckedChange={(enabled) => setEdge({ enabled }, "on")}
          />
          <FieldContent>
            <FieldLabel htmlFor="edge-on" id="edge-heading">
              Progressive blur
            </FieldLabel>
            <FieldDescription id="edge-hint">
              Blur that builds smoothly toward the screen’s edges. Text stays
              sharp.
            </FieldDescription>
          </FieldContent>
        </Field>
        {edge.enabled && (
          <>
            <Field>
              <span className="text-sm font-medium">From</span>
              <ToggleGroup
                aria-label="Blur from"
                variant="outline"
                className="grid grid-cols-3 gap-1"
                value={[edge.from]}
                onValueChange={(values) => {
                  const from = values[0] as BlurEdge | undefined
                  if (from) setEdge({ from }, "from")
                }}
              >
                {blurEdges.map((name) => (
                  <ToggleGroupItem
                    key={name}
                    value={name}
                    className="w-full text-xs"
                  >
                    {edgeLabels[name]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <SliderField
              label="Strength"
              value={edge.strength}
              min={0.1}
              max={2.5}
              step={0.1}
              format={(value) => `${value.toFixed(1)}%`}
              onChange={(strength) => setEdge({ strength }, "strength")}
            />
            <SliderField
              label="Reach"
              value={edge.reach}
              min={0.1}
              max={0.7}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(reach) => setEdge({ reach }, "reach")}
            />
          </>
        )}
      </section>
    </div>
  )
}
