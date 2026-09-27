"use client"

import type { PlayerRef } from "@remotion/player"
import { useEffect, useRef, useState } from "react"

import { stageFps } from "@/remotion/compositions/FootageStage"
import {
  frameGeometry,
  frameProjection,
  isLayoutGraphic,
  isScreenGraphic,
  stageCamera,
  stageLayoutAt,
  toOutputNearest,
  type GraphicBox,
  type GraphicItem,
  type Presentation,
  type TextItem,
  type TimedShot,
} from "@/shared/motion"

/** What a drag changes on an item. */
export type ItemPatch =
  | { kind: "text"; x: number; y: number }
  | { kind: "stage"; at: { x: number; y: number } }
  | { kind: "screen"; box: GraphicBox }

type Target = {
  id: string
  kind: "text" | "stage" | "screen"
  /** Outline in composition px: 4 corners (screen items are projected). */
  corners: { x: number; y: number }[]
  draggable: boolean
}

/** Where things snap while dragged: safe margins, thirds and centre. */
const snapX = [0.08, 1 / 3, 0.5, 2 / 3, 0.92]
const snapY = [0.12, 1 / 3, 0.5, 2 / 3, 0.88]
const snapTo = (value: number, points: number[]) => {
  const near = points.find((point) => Math.abs(point - value) < 0.02)
  return near === undefined
    ? { value, snapped: null }
    : { value: near, snapped: near }
}
/** Where a split has moved the frame to (the composition does the same). */
const layoutAt = (
  p: Presentation,
  durationMs: number,
  adMs: number,
  size: {
    width: number
    height: number
    videoWidth: number
    videoHeight: number
  }
) =>
  stageLayoutAt({
    graphics: p.graphics,
    edit: p.edit,
    durationMs,
    adMs,
    padding: p.frame.padding,
    ...size,
  })

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

/**
 * Select and move things right on the video, like a native editor: every
 * text and graphic showing at the playhead can be clicked; the selected
 * one drags into place. Graphics pinned to the screen move across the
 * tilted screen itself (through the camera's exact projection) and resize
 * from their corner. Shown while paused.
 */
export function StageItemsLayer({
  playerRef,
  width,
  height,
  presentation,
  shots,
  durationMs,
  videoWidth,
  videoHeight,
  reduceMotion,
  selectedId,
  onSelect,
  onMove,
}: {
  playerRef: React.RefObject<PlayerRef | null>
  /** Composition size. */
  width: number
  height: number
  presentation: Presentation
  shots: TimedShot[]
  durationMs: number
  videoWidth: number
  videoHeight: number
  reduceMotion: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, patch: ItemPatch) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })
  const drag = useRef<{
    target: Target
    mode: "move" | "resize"
    start: { x: number; y: number }
    moved: boolean
    item: TextItem | GraphicItem
  } | null>(null)
  // The latest inputs, for the measuring loop (it runs every frame).
  const latest = useRef({ presentation, shots, durationMs })
  useEffect(() => {
    latest.current = { presentation, shots, durationMs }
  })

  // Measure what's on screen at the playhead, every frame while mounted.
  useEffect(() => {
    let raf = 0
    let last = ""
    const measure = () => {
      const svg = svgRef.current
      const player = playerRef.current
      if (svg && player) {
        const { presentation: p, shots: s, durationMs: d } = latest.current
        const adMs = (player.getCurrentFrame() / stageFps) * 1000
        const visible = (atMs: number, length: number) => {
          const start = toOutputNearest(p.edit, d, atMs)
          return adMs >= start && adMs < start + length
        }
        const box = svg.getBoundingClientRect()
        const scale = box.width / width
        const stage = svg.parentElement
        const toStage = (rect: DOMRect) => {
          const x0 = (rect.left - box.left) / scale
          const y0 = (rect.top - box.top) / scale
          const x1 = x0 + rect.width / scale
          const y1 = y0 + rect.height / scale
          return [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
          ]
        }
        const measured = (id: string) => {
          const element = stage?.querySelector<HTMLElement>(
            `[data-item-id="${id}"]`
          )
          return element ? toStage(element.getBoundingClientRect()) : null
        }
        const geometry = frameGeometry({
          width,
          height,
          padding: p.frame.padding,
          videoWidth,
          videoHeight,
        })
        const pose = stageCamera({
          presentation: p,
          shots: s,
          durationMs: d,
          reduceMotion,
        })(adMs)
        const projection = frameProjection({
          pose,
          geometry,
          width,
          height,
          layout: layoutAt(p, d, adMs, {
            width,
            height,
            videoWidth,
            videoHeight,
          }),
        })
        const next: Target[] = []
        for (const text of p.texts) {
          if (!visible(text.atMs, text.durationMs)) continue
          const corners = measured(text.id)
          if (corners)
            next.push({ id: text.id, kind: "text", corners, draggable: true })
        }
        for (const graphic of p.graphics) {
          if (!visible(graphic.atMs, graphic.durationMs)) continue
          if (isScreenGraphic(graphic.kind)) {
            const { x, y, w, h } = graphic.box
            const fw = geometry.frameWidth
            const fh = geometry.frameHeight
            next.push({
              id: graphic.id,
              kind: "screen",
              corners: [
                projection.toStage(x * fw, y * fh),
                projection.toStage((x + w) * fw, y * fh),
                projection.toStage((x + w) * fw, (y + h) * fh),
                projection.toStage(x * fw, (y + h) * fh),
              ],
              draggable: true,
            })
          } else {
            const corners = measured(graphic.id)
            if (corners) {
              next.push({
                id: graphic.id,
                kind: "stage",
                corners,
                draggable:
                  graphic.kind !== "end-card" && !isLayoutGraphic(graphic.kind),
              })
            }
          }
        }
        const key = JSON.stringify(
          next.map((t) => [
            t.id,
            t.corners.map((c) => [Math.round(c.x), Math.round(c.y)]),
          ])
        )
        if (key !== last) {
          last = key
          setTargets(next)
        }
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [playerRef, width, height, videoWidth, videoHeight, reduceMotion])

  /** A pointer position in composition px. */
  const at = (event: React.PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const scale = box.width / width
    return {
      x: (event.clientX - box.left) / scale,
      y: (event.clientY - box.top) / scale,
    }
  }

  function begin(
    event: React.PointerEvent,
    target: Target,
    mode: "move" | "resize"
  ) {
    // No text selection while dragging across the stage.
    event.preventDefault()
    event.stopPropagation()
    const item =
      presentation.texts.find((t) => t.id === target.id) ??
      presentation.graphics.find((g) => g.id === target.id)
    if (!item) return
    event.currentTarget.setPointerCapture(event.pointerId)
    // Pressing an item selects it, and the same press can drag it.
    if (target.id !== selectedId) onSelect(target.id)
    drag.current = { target, mode, start: at(event), moved: false, item }
  }

  function update(event: React.PointerEvent) {
    const current = drag.current
    if (!current) return
    const point = at(event)
    const dx = point.x - current.start.x
    const dy = point.y - current.start.y
    if (!current.moved && Math.hypot(dx, dy) < 3) return
    current.moved = true
    if (!current.target.draggable) return
    const { item, target } = current
    if (target.kind === "text" && "x" in item) {
      const x = snapTo(clamp(item.x + dx / width, 0, 1), snapX)
      const y = snapTo(clamp(item.y + dy / height, 0, 1), snapY)
      setGuides({ x: x.snapped, y: y.snapped })
      onMove(item.id, { kind: "text", x: round(x.value), y: round(y.value) })
    } else if (target.kind === "stage" && "kind" in item) {
      // From its current centre (its own spot until first dragged).
      const xs = target.corners.map((c) => c.x)
      const ys = target.corners.map((c) => c.y)
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const x = snapTo(clamp((cx + dx) / width, 0, 1), snapX)
      const y = snapTo(clamp((cy + dy) / height, 0, 1), snapY)
      setGuides({ x: x.snapped, y: y.snapped })
      onMove(item.id, {
        kind: "stage",
        at: { x: round(x.value), y: round(y.value) },
      })
    } else if (target.kind === "screen" && "box" in item) {
      const p = presentation
      const geometry = frameGeometry({
        width,
        height,
        padding: p.frame.padding,
        videoWidth,
        videoHeight,
      })
      const adMs =
        ((playerRef.current?.getCurrentFrame() ?? 0) / stageFps) * 1000
      const pose = stageCamera({
        presentation: p,
        shots,
        durationMs,
        reduceMotion,
      })(adMs)
      const projection = frameProjection({
        pose,
        geometry,
        width,
        height,
        layout: layoutAt(p, durationMs, adMs, {
          width,
          height,
          videoWidth,
          videoHeight,
        }),
      })
      const from = projection.toFrame(current.start.x, current.start.y)
      const to = projection.toFrame(point.x, point.y)
      const fw = geometry.frameWidth
      const fh = geometry.frameHeight
      const b = item.box
      const box =
        current.mode === "move"
          ? {
              ...b,
              x: clamp(b.x + (to.x - from.x) / fw, 0, 1 - b.w),
              y: clamp(b.y + (to.y - from.y) / fh, 0, 1 - b.h),
            }
          : {
              ...b,
              w: clamp(to.x / fw - b.x, 0.03, 1 - b.x),
              h: clamp(to.y / fh - b.y, 0.03, 1 - b.y),
            }
      onMove(item.id, {
        kind: "screen",
        box: {
          x: round(box.x),
          y: round(box.y),
          w: round(box.w),
          h: round(box.h),
        },
      })
    }
  }

  function finish(event: React.PointerEvent) {
    const current = drag.current
    drag.current = null
    setGuides({ x: null, y: null })
    if (!current) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!current.moved) onSelect(current.target.id)
  }

  const points = (corners: { x: number; y: number }[]) =>
    corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")
  // Selected last, so it's on top.
  const ordered = [...targets].sort(
    (a, b) => Number(a.id === selectedId) - Number(b.id === selectedId)
  )

  return (
    <svg
      ref={svgRef}
      aria-hidden
      data-testid="stage-items"
      className="absolute inset-0 size-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ pointerEvents: "none" }}
    >
      {guides.x !== null && (
        <line
          x1={guides.x * width}
          x2={guides.x * width}
          y1={0}
          y2={height}
          className="stroke-chroma"
          strokeWidth={width / 500}
        />
      )}
      {guides.y !== null && (
        <line
          x1={0}
          x2={width}
          y1={guides.y * height}
          y2={guides.y * height}
          className="stroke-chroma"
          strokeWidth={width / 500}
        />
      )}
      {ordered.map((target) => {
        const isSelected = target.id === selectedId
        const corner = target.corners[2]!
        return (
          <g key={target.id} data-stage-item={target.id}>
            <polygon
              points={points(target.corners)}
              fill="transparent"
              className={
                isSelected
                  ? "cursor-move stroke-chroma"
                  : "cursor-pointer stroke-transparent hover:stroke-chroma/70"
              }
              strokeWidth={width / 480}
              strokeDasharray={
                isSelected ? `${width / 120} ${width / 200}` : undefined
              }
              style={{ pointerEvents: "all" }}
              onPointerDown={(event) => begin(event, target, "move")}
              onPointerMove={update}
              onPointerUp={finish}
              onPointerCancel={finish}
            />
            {isSelected && target.kind === "screen" && (
              <circle
                data-resize-handle
                cx={corner.x}
                cy={corner.y}
                r={width / 110}
                className="cursor-nwse-resize fill-background stroke-chroma"
                strokeWidth={width / 480}
                style={{ pointerEvents: "all" }}
                onPointerDown={(event) => begin(event, target, "resize")}
                onPointerMove={update}
                onPointerUp={finish}
                onPointerCancel={finish}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

const round = (n: number) => Math.round(n * 1000) / 1000
