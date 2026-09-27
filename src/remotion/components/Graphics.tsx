import {
  AbsoluteFill,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import {
  calloutSide,
  countNumbers,
  isLayoutGraphic,
  keycaps,
  toOutputNearest,
  type ClipEdit,
  type GraphicItem,
  type TextAnimation,
} from "@/shared/motion"

import { SplitText, TextSlide } from "./Layouts"
import type { Colors, StageFonts } from "./TextLayer"

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3
/** A small overshoot (≈4%) for things that pop in. */
const easeOutBack = (t: number) => {
  const x = clamp01(t)
  const c = 1.2
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
}

/** 1 while shown, fading in over `inFrames` and out over the last 8. */
function presence(frame: number, total: number, inFrames = 8) {
  return Math.min(
    easeOutCubic(frame / inFrames),
    easeOutCubic((total - frame) / 8)
  )
}

type Timed = { item: GraphicItem; from: number; frames: number }

/** Graphics in ad frames (start from footage time; length in ad time). */
export function timedGraphics(
  items: GraphicItem[],
  edit: ClipEdit,
  durationMs: number,
  fps: number
): Timed[] {
  return items.map((item) => ({
    item,
    from: Math.round(
      (toOutputNearest(edit, durationMs, item.atMs) / 1000) * fps
    ),
    frames: Math.max(1, Math.round((item.durationMs / 1000) * fps)),
  }))
}

// ── On the screen (inside the frame, moving with the camera) ──────────────

/** Stacking inside the frame: layer first, then kind (lens = +2). */
export function screenZ(item: GraphicItem) {
  const under = ["spotlight", "privacy", "focus"].includes(item.kind)
  return item.track * 10 + (under ? 1 : item.kind === "magnifier" ? 2 : 3)
}

/**
 * An SVG mask (as a CSS url) for a focus area: `inside` shows the shape,
 * otherwise everything but it; feathered with a real Gaussian.
 */
export function focusMask(input: {
  width: number
  height: number
  box: { x: number; y: number; w: number; h: number }
  shape: "circle" | "rounded" | "rect"
  feather: number
  inside: boolean
}) {
  const { width: w, height: h, box } = input
  const x = box.x * w
  const y = box.y * h
  const bw = box.w * w
  const bh = box.h * h
  const shape =
    input.shape === "circle"
      ? `<ellipse cx="${(x + bw / 2).toFixed(1)}" cy="${(y + bh / 2).toFixed(1)}" rx="${(bw / 2).toFixed(1)}" ry="${(bh / 2).toFixed(1)}"/>`
      : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${input.shape === "rounded" ? (Math.min(bw, bh) * 0.16).toFixed(1) : 0}"/>`
  const blur =
    input.feather > 0
      ? `<filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(input.feather / 2).toFixed(2)}"/></filter>`
      : ""
  const soft = input.feather > 0 ? ' filter="url(#f)"' : ""
  const svg = input.inside
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}"><defs>${blur}</defs><g fill="#000"${soft}>${shape}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}"><defs>${blur}<mask id="m"><rect width="100%" height="100%" fill="#fff"/><g fill="#000"${soft}>${shape}</g></mask></defs><rect width="100%" height="100%" fill="#000" mask="url(#m)"/></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

/**
 * Graphics pinned to the recording. Drawn in the frame's own pixels
 * (`width`×`height`), so they follow every camera move exactly.
 */
export function ScreenGraphics({
  items,
  width,
  height,
  colors,
  fonts,
  stageWidth,
}: {
  items: Timed[]
  width: number
  height: number
  colors: Colors
  fonts: StageFonts
  /** The composition's width (focus blur is a % of it). */
  stageWidth: number
}) {
  return (
    <>
      {items.map(({ item, from, frames }) => (
        <Sequence
          key={item.id}
          from={from}
          durationInFrames={frames}
          layout="none"
        >
          <ScreenGraphic
            item={item}
            frames={frames}
            width={width}
            height={height}
            colors={colors}
            fonts={fonts}
            stageWidth={stageWidth}
          />
        </Sequence>
      ))}
    </>
  )
}

function ScreenGraphic({
  item,
  frames,
  width: w,
  height: h,
  colors,
  fonts,
  stageWidth,
}: {
  item: GraphicItem
  frames: number
  width: number
  height: number
  colors: Colors
  fonts: StageFonts
  stageWidth: number
}) {
  const frame = useCurrentFrame()
  const u = w / 100
  const box = {
    x: item.box.x * w,
    y: item.box.y * h,
    w: item.box.w * w,
    h: item.box.h * h,
  }
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const shown = presence(frame, frames)
  const fill: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    // By layer; within one, blurs and dimming under the magnifier's lens
    // and marks above it.
    zIndex: screenZ(item),
  }

  switch (item.kind) {
    case "focus": {
      const f = item.focus
      // Fades by strength (opacity would stop the blur sampling what's under).
      const t = easeOutCubic(frame / 10) * easeOutCubic((frames - frame) / 10)
      const mask = focusMask({
        width: w,
        height: h,
        box: item.box,
        shape: f.shape,
        feather: (f.feather / 100) * w,
        inside: f.invert,
      })
      const blurPx = (f.strength / 100) * stageWidth * t
      const layer: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }
      return (
        <div style={fill}>
          <div
            style={{
              ...layer,
              backdropFilter: `blur(${blurPx.toFixed(2)}px)`,
              WebkitBackdropFilter: `blur(${blurPx.toFixed(2)}px)`,
            }}
          />
          {f.dim > 0 && (
            <div
              style={{
                ...layer,
                background: `rgb(0 0 0 / ${(f.dim * t).toFixed(3)})`,
              }}
            />
          )}
        </div>
      )
    }
    case "ripple": {
      const ring = (delay: number) => {
        const t = clamp01((frame - delay) / 14)
        return (
          <span
            key={delay}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: 7 * u,
              height: 7 * u,
              marginLeft: -3.5 * u,
              marginTop: -3.5 * u,
              borderRadius: "50%",
              border: `${0.45 * u}px solid #ffffff`,
              boxShadow: `0 0 ${0.8 * u}px rgb(0 0 0 / 0.35)`,
              transform: `scale(${(0.3 + 1.3 * easeOutCubic(t)).toFixed(3)})`,
              opacity: t <= 0 ? 0 : 0.8 * (1 - t),
            }}
          />
        )
      }
      const dot = easeOutBack(frame / 6) * (1 - clamp01((frame - 16) / 8))
      return (
        <div style={fill}>
          {ring(0)}
          {ring(7)}
          <span
            style={{
              position: "absolute",
              left: cx - 1.2 * u,
              top: cy - 1.2 * u,
              width: 2.4 * u,
              height: 2.4 * u,
              borderRadius: "50%",
              background: colors.accent,
              boxShadow: `0 0 0 ${0.35 * u}px #ffffff`,
              transform: `scale(${dot.toFixed(3)})`,
            }}
          />
        </div>
      )
    }
    case "spotlight": {
      const pad = 1.2 * u
      const grow = 1.04 - 0.04 * easeOutCubic(frame / 12)
      return (
        <div style={fill}>
          <span
            style={{
              position: "absolute",
              left: box.x - pad,
              top: box.y - pad,
              width: box.w + 2 * pad,
              height: box.h + 2 * pad,
              borderRadius: 1.2 * u,
              transform: `scale(${grow.toFixed(4)})`,
              boxShadow: `0 0 0 ${3 * Math.max(w, h)}px rgb(0 0 0 / ${(0.6 * shown).toFixed(3)}), 0 0 0 ${0.25 * u}px rgb(255 255 255 / ${(0.85 * shown).toFixed(3)})`,
            }}
          />
        </div>
      )
    }
    case "privacy":
      return (
        <div style={fill}>
          <span
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              borderRadius: 0.8 * u,
              opacity:
                easeOutCubic(frame / 6) * easeOutCubic((frames - frame) / 6),
              backdropFilter: `blur(${1.6 * u}px)`,
              WebkitBackdropFilter: `blur(${1.6 * u}px)`,
              background: "rgb(128 128 128 / 0.18)",
            }}
          />
        </div>
      )
    case "callout":
      return (
        <Callout
          item={item}
          box={box}
          frame={frame}
          shown={shown}
          u={u}
          w={w}
          h={h}
          colors={colors}
          fonts={fonts}
        />
      )
    case "circle":
    case "underline": {
      const draw = easeOutCubic(frame / (item.kind === "circle" ? 16 : 12))
      const path =
        item.kind === "circle"
          ? handCircle(cx, cy, box.w / 2 + 2 * u, box.h / 2 + 2 * u)
          : handUnderline(
              box.x - u,
              box.x + box.w + u,
              box.y + box.h + 1.4 * u,
              u
            )
      return (
        <svg width={w} height={h} style={{ ...fill, opacity: shown }}>
          <path
            d={path}
            pathLength={1}
            fill="none"
            stroke={colors.accent}
            strokeWidth={0.55 * u}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            strokeDashoffset={(1 - draw).toFixed(4)}
            style={{
              filter: `drop-shadow(0 ${0.15 * u}px ${0.3 * u}px rgb(0 0 0 / 0.3))`,
            }}
          />
        </svg>
      )
    }
    default:
      return null
  }
}

/** A hand-drawn loop: an ellipse that wobbles a little and overshoots. */
function handCircle(cx: number, cy: number, rx: number, ry: number) {
  const points: string[] = []
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    // From -100° round 380°, so the stroke crosses itself like a pen.
    const a = ((-100 + (380 * i) / steps) * Math.PI) / 180
    const wobble = 1 + 0.035 * Math.sin(i * 0.9) + 0.02 * Math.sin(i * 2.3)
    const grow = 1 + (0.06 * i) / steps
    const x = cx + rx * wobble * grow * Math.cos(a)
    const y = cy + ry * wobble * Math.sin(a)
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return points.join(" ")
}

/** A quick, slightly curved stroke under something. */
function handUnderline(x1: number, x2: number, y: number, u: number) {
  const mid = (x1 + x2) / 2
  return `M${x1.toFixed(1)} ${(y + 0.3 * u).toFixed(1)} Q${mid.toFixed(1)} ${(y - 0.9 * u).toFixed(1)} ${x2.toFixed(1)} ${(y - 0.2 * u).toFixed(1)}`
}

function Callout({
  item,
  box,
  frame,
  shown,
  u,
  w,
  h,
  colors,
  fonts,
}: {
  item: GraphicItem
  box: { x: number; y: number; w: number; h: number }
  frame: number
  shown: number
  u: number
  w: number
  h: number
  colors: Colors
  fonts: StageFonts
}) {
  const side = calloutSide(item.box, item.side)
  const gap = 9 * u
  // Where the label sits, and where the arrow lands on the box.
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const label =
    side === "left"
      ? { x: box.x - gap, y: cy, tx: "-100%", ty: "-50%" }
      : side === "right"
        ? { x: box.x + box.w + gap, y: cy, tx: "0%", ty: "-50%" }
        : side === "top"
          ? { x: cx, y: box.y - gap, tx: "-50%", ty: "-100%" }
          : { x: cx, y: box.y + box.h + gap, tx: "-50%", ty: "0%" }
  const tip =
    side === "left"
      ? { x: box.x - 0.8 * u, y: cy }
      : side === "right"
        ? { x: box.x + box.w + 0.8 * u, y: cy }
        : side === "top"
          ? { x: cx, y: box.y - 0.8 * u }
          : { x: cx, y: box.y + box.h + 0.8 * u }
  const tail = {
    x: label.x + (side === "left" ? -0.5 * u : side === "right" ? 0.5 * u : 0),
    y: label.y + (side === "top" ? -0.5 * u : side === "bottom" ? 0.5 * u : 0),
  }
  // A gentle bend, like a hand-drawn arrow.
  const bend = {
    x: (tail.x + tip.x) / 2 + (side === "top" || side === "bottom" ? 3 * u : 0),
    y:
      (tail.y + tip.y) / 2 + (side === "left" || side === "right" ? -3 * u : 0),
  }
  const angle = Math.atan2(tip.y - bend.y, tip.x - bend.x)
  const head = (spread: number) =>
    `${(tip.x - 1.8 * u * Math.cos(angle + spread)).toFixed(1)} ${(tip.y - 1.8 * u * Math.sin(angle + spread)).toFixed(1)}`
  const draw = easeOutCubic(frame / 14)
  const pop = easeOutBack((frame - 6) / 10)
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: shown,
        zIndex: screenZ(item),
      }}
    >
      <svg
        width={w}
        height={h}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <path
          d={`M${tail.x.toFixed(1)} ${tail.y.toFixed(1)} Q${bend.x.toFixed(1)} ${bend.y.toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`}
          pathLength={1}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.5 * u}
          strokeLinecap="round"
          strokeDasharray="1"
          strokeDashoffset={(1 - draw).toFixed(4)}
          style={{
            filter: `drop-shadow(0 ${0.15 * u}px ${0.4 * u}px rgb(0 0 0 / 0.45))`,
          }}
        />
        {draw > 0.95 && (
          <path
            d={`M${head(-0.5)} L${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${head(0.5)}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={0.5 * u}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span
        style={{
          position: "absolute",
          left: label.x,
          top: label.y,
          transform: `translate(${label.tx}, ${label.ty}) scale(${(0.85 + 0.15 * pop).toFixed(3)})`,
          opacity: clamp01(pop),
          background: "#ffffff",
          color: "#15171c",
          fontFamily: fonts.body,
          fontWeight: 650,
          fontSize: 2.6 * u * item.textSize,
          lineHeight: 1.2,
          padding: `${0.7 * u * item.textSize}px ${1.4 * u * item.textSize}px`,
          borderRadius: 999,
          whiteSpace: "nowrap",
          boxShadow: `0 ${0.4 * u}px ${1.4 * u}px rgb(0 0 0 / 0.3), inset 0 0 0 ${0.18 * u}px ${colors.accent}`,
        }}
      >
        {item.text || "Look here"}
      </span>
    </div>
  )
}

/**
 * The magnifier's lens: the same footage at 2×, clipped to a circle over
 * the box. Rendered inside a footage part (with its own video synced to
 * the part), so what it shows is exactly what's on screen.
 */
export function MagnifierLens({
  z,
  box,
  frames,
  frame,
  width: w,
  height: h,
  video,
}: {
  /** Stacking in the frame (screenZ). */
  z: number
  box: GraphicItem["box"]
  frames: number
  frame: number
  width: number
  height: number
  video: React.ReactNode
}) {
  const u = w / 100
  const cx = (box.x + box.w / 2) * w
  const cy = (box.y + box.h / 2) * h
  const size = Math.min(Math.max(box.w * w, box.h * h) * 1.5, 38 * u)
  const pop = easeOutBack(frame / 12)
  const out = easeOutCubic((frames - frame) / 8)
  return (
    <div
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        // Above dimming, under labels, by layer (see screenZ).
        zIndex: z,
        transform: `scale(${(0.8 + 0.2 * pop).toFixed(3)})`,
        opacity: clamp01(pop) * out,
        boxShadow: `0 0 0 ${0.45 * u}px #ffffff, 0 ${1.2 * u}px ${3 * u}px rgb(0 0 0 / 0.45)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: size / 2 - cx * 2,
          top: size / 2 - cy * 2,
          width: w * 2,
          height: h * 2,
        }}
      >
        {video}
      </div>
    </div>
  )
}

// ── On the stage ───────────────────────────────────────────────────────────

/** Stage graphics; the end card goes above text (it closes the ad). */
export function StageGraphics({
  items,
  colors,
  fonts,
  logoUrl,
  brandName,
  siteLabel,
  background,
  animation,
}: {
  items: Timed[]
  colors: Colors
  fonts: StageFonts
  logoUrl: string | null
  brandName: string
  siteLabel: string
  background: string
  /** The video's text style, for slides and splits. */
  animation: TextAnimation
}) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {items.map(({ item, from, frames }) => (
        <Sequence
          key={item.id}
          from={from}
          durationInFrames={frames}
          layout="none"
        >
          <StageGraphicPlaced
            item={item}
            frames={frames}
            colors={colors}
            fonts={fonts}
            logoUrl={logoUrl}
            brandName={brandName}
            siteLabel={siteLabel}
            background={background}
            animation={animation}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

function Logo({
  logoUrl,
  brandName,
  fonts,
  height,
  color,
}: {
  logoUrl: string | null
  brandName: string
  fonts: StageFonts
  height: number
  color: string
}) {
  return logoUrl ? (
    <Img
      src={logoUrl}
      alt=""
      style={{
        height,
        maxWidth: "40%",
        objectFit: "contain",
        display: "block",
      }}
    />
  ) : (
    <span
      style={{
        fontFamily: fonts.heading,
        fontWeight: fonts.headingWeight,
        fontSize: height * 0.7,
        color,
        letterSpacing: "-0.02em",
      }}
    >
      {brandName}
    </span>
  )
}

/** Layer order, and a position the owner dragged it to (if any). */
function StageGraphicPlaced(
  props: Omit<React.ComponentProps<typeof StageGraphic>, "placed">
) {
  const { item } = props
  const at =
    item.kind === "end-card" || isLayoutGraphic(item.kind) ? null : item.at
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Higher layers draw over lower ones; text on a layer sits over
        // graphics on the same layer.
        zIndex: 1 + item.track * 10,
      }}
    >
      {at ? (
        <div
          data-item-id={item.id}
          style={{
            position: "absolute",
            left: `${at.x * 100}%`,
            top: `${at.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <StageGraphic {...props} placed />
        </div>
      ) : (
        <StageGraphic {...props} placed={false} />
      )}
    </div>
  )
}

/** Its own spot, or (placed) none: the wrapper positions it. */
function spot(placed: boolean, base: React.CSSProperties): React.CSSProperties {
  if (!placed) return base
  const {
    position: _p,
    left: _l,
    right: _r,
    top: _t,
    bottom: _b,
    ...rest
  } = base
  return { ...rest, position: "relative" }
}

function StageGraphic({
  item,
  frames,
  placed,
  colors,
  fonts,
  logoUrl,
  brandName,
  siteLabel,
  background,
  animation,
}: {
  item: GraphicItem
  frames: number
  colors: Colors
  fonts: StageFonts
  logoUrl: string | null
  brandName: string
  siteLabel: string
  background: string
  animation: TextAnimation
  placed: boolean
}) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const id = placed ? {} : { "data-item-id": item.id }
  const su = Math.min(width, height) / 100
  const shown = presence(frame, frames, 10)
  const rise = (delay: number, frames = 12) => {
    const t = easeOutCubic((frame - delay) / frames)
    return {
      opacity: t * shown,
      transform: `translateY(${((1 - t) * 1.5 * su).toFixed(2)}px)`,
    }
  }

  switch (item.kind) {
    case "keys": {
      const caps = keycaps(item.text || "⌘ K")
      // Keycaps scale as a whole with the text size.
      const ku = su * item.textSize
      return (
        <div
          {...id}
          style={spot(placed, {
            position: "absolute",
            left: "50%",
            bottom: "9%",
            translate: placed ? undefined : "-50% 0",
            display: "flex",
            gap: 1.4 * ku,
            opacity: presence(frame, frames, 4),
          })}
        >
          {caps.map((cap, i) => {
            const t = easeOutBack((frame - 3 * i) / 10)
            return (
              <span
                key={i}
                style={{
                  minWidth: 7.5 * ku,
                  height: 7.5 * ku,
                  padding: `0 ${2 * ku}px`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 1.3 * ku,
                  background: "linear-gradient(#ffffff, #eceef1)",
                  borderBottom: `${0.6 * ku}px solid #c4c8cf`,
                  boxShadow: `0 ${0.8 * ku}px ${2 * ku}px rgb(0 0 0 / 0.35)`,
                  color: "#15171c",
                  fontFamily: fonts.body,
                  fontWeight: 700,
                  fontSize: 3.6 * ku,
                  transform: `translateY(${((1 - t) * ku).toFixed(2)}px) scale(${(0.6 + 0.4 * t).toFixed(3)})`,
                  opacity: clamp01(t * 2),
                }}
              >
                {cap}
              </span>
            )
          })}
        </div>
      )
    }
    case "stat": {
      const t = easeOutCubic(frame / 24)
      const value = countNumbers(item.text || "12", t) ?? item.text
      return (
        <div
          {...id}
          style={spot(placed, {
            position: "absolute",
            right: "5%",
            top: "8%",
            padding: `${2.2 * su}px ${3 * su}px`,
            borderRadius: 2 * su,
            background: "rgb(255 255 255 / 0.96)",
            boxShadow: `0 ${1.2 * su}px ${4 * su}px rgb(0 0 0 / 0.35)`,
            color: "#15171c",
            ...rise(0, 14),
            filter: `blur(${((1 - easeOutCubic(frame / 14)) * 0.6 * su).toFixed(2)}px)`,
          })}
        >
          <div
            style={{
              fontFamily: fonts.heading,
              fontWeight: fonts.headingWeight,
              fontSize: 7 * su * item.textSize,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              color: colors.accent === "#ffffff" ? "#15171c" : undefined,
            }}
          >
            {value}
          </div>
          {item.secondary && (
            <div
              style={{
                fontFamily: fonts.body,
                fontSize: 2.4 * su * item.secondarySize,
                marginTop: 0.8 * su,
                color: "#5b6170",
              }}
            >
              {item.secondary}
            </div>
          )}
        </div>
      )
    }
    case "lower-third": {
      const bar = easeOutCubic(frame / 8)
      return (
        <div
          {...id}
          style={spot(placed, {
            position: "absolute",
            left: "6%",
            bottom: "9%",
            display: "flex",
            alignItems: "stretch",
            gap: 1.6 * su,
            opacity: shown,
          })}
        >
          <span
            style={{
              width: 0.8 * su,
              borderRadius: 0.4 * su,
              background: colors.accent,
              transform: `scaleY(${bar.toFixed(3)})`,
              transformOrigin: "bottom",
            }}
          />
          <div>
            <div
              style={{
                fontFamily: fonts.heading,
                fontWeight: fonts.headingWeight,
                fontSize: 3.8 * su * item.textSize,
                color: colors.base,
                textShadow: colors.shadow
                  ? "0 0.04em 0.35em rgb(0 0 0 / 0.35)"
                  : undefined,
                ...rise(6),
              }}
            >
              {item.text || brandName}
            </div>
            {item.secondary && (
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: 2.4 * su * item.secondarySize,
                  color: colors.base,
                  marginTop: 0.4 * su,
                  ...rise(10),
                  opacity: 0.8 * rise(10).opacity,
                }}
              >
                {item.secondary}
              </div>
            )}
          </div>
        </div>
      )
    }
    case "logo": {
      const t = easeOutCubic(frame / 22)
      return (
        <AbsoluteFill
          {...id}
          style={
            placed
              ? { position: "relative", inset: "auto" }
              : { alignItems: "center", justifyContent: "center" }
          }
        >
          <div
            style={{
              opacity: t * shown,
              filter: `blur(${((1 - t) * 2 * su).toFixed(2)}px)`,
              transform: `scale(${(1.06 - 0.06 * t).toFixed(4)})`,
            }}
          >
            <Logo
              logoUrl={logoUrl}
              brandName={brandName}
              fonts={fonts}
              height={14 * su}
              color={colors.base}
            />
          </div>
        </AbsoluteFill>
      )
    }
    case "end-card": {
      // A light sweep across the button every 1.5s.
      const sweep = ((frame % 45) / 45) * 260 - 80
      return (
        <AbsoluteFill
          data-item-id={item.id}
          style={{
            background,
            opacity: easeOutCubic(frame / 12),
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 2.6 * su,
            textAlign: "center",
          }}
        >
          <div style={rise(4)}>
            <Logo
              logoUrl={logoUrl}
              brandName={brandName}
              fonts={fonts}
              height={9 * su}
              color={colors.base}
            />
          </div>
          <div
            style={{
              fontFamily: fonts.heading,
              fontWeight: fonts.headingWeight,
              fontSize: 6 * su * item.textSize,
              lineHeight: 1.08,
              color: colors.base,
              maxWidth: "80%",
              ...rise(9),
            }}
          >
            {item.text || "Try it free today"}
          </div>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              padding: `${1.6 * su * item.secondarySize}px ${4 * su * item.secondarySize}px`,
              borderRadius: 999,
              background: colors.accent,
              color: colors.onAccent,
              fontFamily: fonts.body,
              fontWeight: 700,
              fontSize: 3 * su * item.secondarySize,
              ...rise(14),
            }}
          >
            {item.secondary || "Get started"}
            <span
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(100deg, transparent ${sweep}%, rgb(255 255 255 / 0.45) ${sweep + 10}%, transparent ${sweep + 20}%)`,
              }}
            />
          </div>
          {siteLabel && (
            <div
              style={{
                fontFamily: fonts.body,
                fontSize: 2.4 * su,
                color: colors.base,
                ...rise(18),
                opacity: 0.75 * rise(18).opacity,
              }}
            >
              {siteLabel}
            </div>
          )}
        </AbsoluteFill>
      )
    }
    case "slide":
      return (
        <TextSlide
          item={item}
          frames={frames}
          colors={colors}
          fonts={fonts}
          background={background}
          animation={animation}
        />
      )
    case "split":
      return (
        <SplitText
          item={item}
          frames={frames}
          colors={colors}
          fonts={fonts}
          animation={animation}
        />
      )
    default:
      return null
  }
}

/** A slow drift of light across the background (constant speed). */
export function BackgroundLight({ totalFrames }: { totalFrames: number }) {
  const frame = useCurrentFrame()
  // Linear: the one place linear motion is right (research: constant drift).
  const t = frame / Math.max(1, totalFrames)
  const x = 15 + 70 * t
  const y = 35 + 15 * Math.sin(t * Math.PI * 2)
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x.toFixed(2)}% ${y.toFixed(2)}%, rgb(255 255 255 / 0.16), transparent 55%), radial-gradient(circle at ${(100 - x).toFixed(2)}% ${(100 - y).toFixed(2)}%, rgb(255 255 255 / 0.07), transparent 50%)`,
      }}
    />
  )
}
