"use client"

import { ArrowDownToLineIcon, ArrowUpToLineIcon } from "lucide-react"

import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"

/** The data a preset card carries when dragged onto the timeline. */
export const dragMime = "application/x-reelpilot-item"
export type DragPayload =
  { type: "text"; preset: string } | { type: "graphic"; kind: string }

/** Makes a preset card draggable onto the timeline (a click still adds it). */
export function draggablePreset(payload: DragPayload) {
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData(dragMime, JSON.stringify(payload))
      event.dataTransfer.effectAllowed = "copy"
    },
  }
}

/**
 * An item's layer on the timeline: higher layers draw over lower ones,
 * like tracks in a video editor. The keyboard-friendly twin of dragging a
 * block up or down.
 */
export function LayerControl({
  track,
  onChange,
}: {
  track: number
  onChange: (track: number) => void
}) {
  return (
    <Field>
      <span className="text-sm font-medium">Layer {track + 1}</span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={track >= 9}
          onClick={() => onChange(track + 1)}
        >
          <ArrowUpToLineIcon data-icon="inline-start" />
          Bring forward
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={track <= 0}
          onClick={() => onChange(track - 1)}
        >
          <ArrowDownToLineIcon data-icon="inline-start" />
          Send backward
        </Button>
      </div>
    </Field>
  )
}
