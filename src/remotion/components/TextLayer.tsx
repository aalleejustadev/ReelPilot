import { useLayoutEffect, useRef, useState } from "react"
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import {
  countNumbers,
  luminance,
  parseSwap,
  plainText,
  readableOn,
  toOutputNearest,
  type ClipEdit,
  type Presentation,
  type TextAnimation,
  type TextItem,
  type TextRole,
} from "@/shared/motion"

export type StageFonts = {
  /** CSS font-family for headlines. */
  heading: string
  headingWeight: number
  /** CSS font-family for everything else. */
  body: string
}

export const defaultStageFonts: StageFonts = {
  heading: "Inter, system-ui, sans-serif",
  headingWeight: 700,
  body: "Inter, system-ui, sans-serif",
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3
const easeOutQuart = (t: number) => 1 - (1 - clamp01(t)) ** 4
const easeInCubic = (t: number) => clamp01(t) ** 3

/** Contrast ratio between two colours (WCAG). */
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** Highlighter yellow: the accent when no brand or footage colour reads. */
const fallbackAccent = "#facc15"

/**
 * Colours for text on this background: base, accent (the first of
 * `accents` that stands out from the background at 3:1, else highlighter
 * yellow), and text on the accent.
 */
export function textColors(
  background: Presentation["background"],
  accents: (string | null | undefined)[]
) {
  // The middle of a gradient stands for the whole.
  const mid = luminance(background.from) / 2 + luminance(background.to) / 2
  const base = mid > 0.4 ? "#15171c" : "#ffffff"
  const reference = mid > 0.4 ? "#f5f5f4" : "#15171c"
  const accent =
    accents.find(
      (color): color is string => !!color && contrast(color, reference) >= 3
    ) ?? fallbackAccent
  // For marks drawn straight on the stage (a slide's rule): the accent
  // only if it stands out from both ends of the actual background.
  const stageAccent =
    [accent, ...accents].find(
      (color): color is string =>
        !!color &&
        contrast(color, background.from) >= 3 &&
        contrast(color, background.to) >= 3
    ) ?? base
  return {
    base,
    accent,
    stageAccent,
    onAccent: readableOn(accent),
    shadow: base === "#ffffff",
  }
}

const roleStyle: Record<
  TextRole,
  { size: number; lineHeight: number; tracking: string; maxWidth: string }
> = {
  headline: {
    size: 6.4,
    lineHeight: 1.06,
    tracking: "-0.015em",
    maxWidth: "82%",
  },
  kicker: { size: 2.3, lineHeight: 1.2, tracking: "0.16em", maxWidth: "70%" },
  label: { size: 3, lineHeight: 1.2, tracking: "0", maxWidth: "60%" },
  caption: { size: 3.4, lineHeight: 1.3, tracking: "0", maxWidth: "80%" },
}

/** Frames each animation takes to come in, for `text`. */
function entryFrames(animation: TextAnimation, text: string) {
  const words = plainText(text).split(/\s+/).filter(Boolean).length
  switch (animation) {
    case "word-rise":
      return 13 + 3.5 * (words - 1)
    case "mask-reveal":
      return 16 + 2.5 * (words - 1)
    case "blur-resolve":
      return 18
    case "marker-sweep":
      return 10 + 2 * (words - 1) + 15
    case "keyword-swap":
      return 12 + 3 * (words - 1)
    case "typewriter":
      return Math.ceil(plainText(text).length / 1.6)
    case "number-ticker":
      return 24
    case "tracking-in":
      return 22
  }
}

/** All text items, each in its own Sequence at its time in the ad. */
export function TextLayer({
  items,
  animation,
  edit,
  durationMs,
  fonts,
  background,
  accents,
}: {
  items: TextItem[]
  /** The video's text style (items can pick their own). */
  animation: TextAnimation
  edit: ClipEdit
  durationMs: number
  fonts: StageFonts
  background: Presentation["background"]
  /** Brand and footage colours, best first. */
  accents: (string | null | undefined)[]
}) {
  const { fps } = useVideoConfig()
  const colors = textColors(background, accents)
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {items.map((item) => {
        const startMs = toOutputNearest(edit, durationMs, item.atMs)
        return (
          <Sequence
            key={item.id}
            from={Math.round((startMs / 1000) * fps)}
            durationInFrames={Math.max(
              1,
              Math.round((item.durationMs / 1000) * fps)
            )}
            layout="none"
          >
            <TextItemView
              item={item}
              animation={item.animation ?? animation}
              fonts={fonts}
              colors={colors}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

export type Colors = ReturnType<typeof textColors>

/** Splits text into words and spaces, marking the emphasised words. */
function tokens(text: string, emphasis: string) {
  const lower = text.toLowerCase()
  const at = emphasis.trim() ? lower.indexOf(emphasis.trim().toLowerCase()) : -1
  const end = at + emphasis.trim().length
  let offset = 0
  return text.split(/(\s+)/).map((part) => {
    const start = offset
    offset += part.length
    return {
      text: part,
      space: /^\s+$/.test(part),
      emphasis: at >= 0 && start < end && offset > at,
    }
  })
}

/** One text item, animated in (and out) by the current frame. */
export function TextItemView({
  item,
  animation,
  fonts,
  colors,
}: {
  item: TextItem
  animation: TextAnimation
  fonts: StageFonts
  colors: Colors
}) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const unit = Math.min(width, height) / 100
  const role = roleStyle[item.role]
  const total = Math.round((item.durationMs / 1000) * fps)
  const entry = entryFrames(animation, item.text)
  // Out faster than in (about two-thirds), in the last frames.
  const exitFrames = Math.max(6, Math.round(Math.min(entry, 18) * 0.65))
  const exitT = easeInCubic((frame - (total - exitFrames)) / exitFrames)
  const isHeadline = item.role === "headline"

  const translate =
    item.align === "left" ? "0%" : item.align === "right" ? "-100%" : "-50%"
  const pill = item.role === "label"
  const scrim = item.role === "caption"

  const container: React.CSSProperties = {
    position: "absolute",
    left: `${item.x * 100}%`,
    top: `${item.y * 100}%`,
    transform: `translate(${translate}, -50%) translateY(${(-exitT * 0.25).toFixed(3)}em)`,
    opacity: 1 - exitT,
    maxWidth: role.maxWidth,
    width: "max-content",
    textAlign: item.align,
    fontFamily: isHeadline ? fonts.heading : fonts.body,
    fontWeight: isHeadline
      ? fonts.headingWeight
      : item.role === "caption"
        ? 500
        : 650,
    fontSize: `${role.size * unit * item.size}px`,
    lineHeight: role.lineHeight,
    letterSpacing: role.tracking,
    textTransform: item.role === "kicker" ? "uppercase" : undefined,
    color:
      item.color ??
      (item.background
        ? readableOn(item.background)
        : pill
          ? readableOn(colors.base === "#ffffff" ? "#ffffff" : "#15171c")
          : item.role === "kicker"
            ? colors.accent
            : scrim
              ? "#ffffff"
              : colors.base),
    textShadow:
      colors.shadow && !pill && !scrim
        ? "0 0.04em 0.35em rgb(0 0 0 / 0.35)"
        : undefined,
    textRendering: "geometricPrecision",
    fontVariantNumeric:
      animation === "number-ticker" ? "tabular-nums" : undefined,
    ...(pill && {
      background: colors.base === "#ffffff" ? "#ffffff" : "#15171c",
      padding: "0.35em 0.8em",
      borderRadius: "999px",
      boxShadow: "0 0.3em 1em rgb(0 0 0 / 0.25)",
    }),
    ...(scrim && {
      background: "rgb(0 0 0 / 0.55)",
      padding: "0.3em 0.7em",
      borderRadius: "0.35em",
    }),
    // The owner's box behind the text (a label keeps its pill shape).
    ...(item.background && {
      background: item.background,
      padding: pill ? "0.35em 0.8em" : "0.3em 0.6em",
      borderRadius: pill ? "999px" : "0.3em",
      textShadow: undefined,
    }),
  }

  return (
    // data-item-id lets the editor find it to select and drag it; higher
    // layers draw over lower ones (text over graphics on the same layer).
    <div
      style={{ ...container, zIndex: 2 + item.track * 10 }}
      data-item-id={item.id}
    >
      <AnimatedText
        item={item}
        animation={animation}
        frame={frame}
        colors={
          item.highlightColor
            ? {
                ...colors,
                accent: item.highlightColor,
                onAccent: readableOn(item.highlightColor),
              }
            : colors
        }
      />
    </div>
  )
}

export function AnimatedText({
  item,
  animation,
  frame,
  colors,
}: {
  item: TextItem
  animation: TextAnimation
  frame: number
  colors: Colors
}) {
  const emphasisColor = item.role === "kicker" ? undefined : colors.accent
  const words = tokens(plainText(item.text), item.emphasis)

  const wordSpan = (
    token: (typeof words)[number],
    index: number,
    style: React.CSSProperties
  ) =>
    token.space ? (
      <span key={index}>{token.text}</span>
    ) : (
      <span
        key={index}
        style={{
          display: "inline-block",
          color: token.emphasis ? emphasisColor : undefined,
          ...style,
        }}
      >
        {token.text}
      </span>
    )

  switch (animation) {
    case "word-rise": {
      let n = 0
      return (
        <>
          {words.map((token, i) => {
            if (token.space) return wordSpan(token, i, {})
            const e = easeOutCubic((frame - 3.5 * n++) / 13)
            return wordSpan(token, i, {
              opacity: e,
              transform: `translateY(${((1 - e) * 0.45).toFixed(3)}em)`,
            })
          })}
        </>
      )
    }
    case "mask-reveal": {
      let n = 0
      return (
        <>
          {words.map((token, i) => {
            if (token.space) return <span key={i}>{token.text}</span>
            const e = easeOutQuart((frame - 2.5 * n++) / 16)
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  verticalAlign: "top",
                  paddingBottom: "0.08em",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${((1 - e) * 110).toFixed(2)}%)`,
                    color: token.emphasis ? emphasisColor : undefined,
                  }}
                >
                  {token.text}
                </span>
              </span>
            )
          })}
        </>
      )
    }
    case "marker-sweep": {
      // The text rises in quickly, then a highlighter sweeps under the
      // emphasised words (or all of them).
      let n = 0
      const count = words.filter((t) => !t.space).length
      const textDone = 10 + 2 * (count - 1)
      const sweep = easeOutCubic((frame - textDone - 4) / 11)
      const marked = words.some((t) => t.emphasis)
      return (
        <>
          {words.map((token, i) => {
            if (token.space) return <span key={i}>{token.text}</span>
            const e = easeOutCubic((frame - 2 * n++) / 10)
            const inBar = marked ? token.emphasis : true
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  position: "relative",
                  // Keeps the highlighter behind this word, not the card.
                  isolation: "isolate",
                  opacity: e,
                  transform: `translateY(${((1 - e) * 0.3).toFixed(3)}em)`,
                  color: inBar && sweep > 0.5 ? colors.onAccent : undefined,
                  textShadow: inBar && sweep > 0.5 ? "none" : undefined,
                }}
              >
                {inBar && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: "0.06em -0.14em 0.02em",
                      background: colors.accent,
                      borderRadius: "0.12em",
                      transform: `scaleX(${sweep.toFixed(3)})`,
                      transformOrigin: "left center",
                      zIndex: -1,
                    }}
                  />
                )}
                {token.text}
              </span>
            )
          })}
        </>
      )
    }
    case "blur-resolve": {
      const e = easeOutCubic(frame / 18)
      return (
        <span
          style={{
            display: "inline-block",
            opacity: e,
            filter: `blur(${((1 - e) * 0.25).toFixed(3)}em)`,
            transform: `scale(${(1.04 - 0.04 * e).toFixed(4)})`,
          }}
        >
          {words.map((token, i) => wordSpan(token, i, {}))}
        </span>
      )
    }
    case "keyword-swap": {
      const swap = parseSwap(item.text)
      if (!swap)
        return (
          <AnimatedText {...{ item, frame, colors }} animation="word-rise" />
        )
      return (
        <KeywordSwap
          before={swap.before}
          words={swap.words}
          after={swap.after}
          frame={frame}
          color={emphasisColor}
        />
      )
    }
    case "typewriter": {
      const text = plainText(item.text)
      const shown = Math.min(text.length, Math.floor(frame * 1.6))
      const typing = shown < text.length
      const caretOn = typing || Math.floor(frame / 16) % 2 === 0
      return (
        <span>
          {text.slice(0, shown)}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: "0.08em",
              height: "1em",
              marginLeft: "0.05em",
              verticalAlign: "-0.12em",
              background: "currentColor",
              opacity: caretOn ? 1 : 0,
            }}
          />
        </span>
      )
    }
    case "number-ticker": {
      const e = easeOutCubic(frame / 24)
      const counted = countNumbers(plainText(item.text), e)
      if (counted === null) {
        return (
          <AnimatedText {...{ item, frame, colors }} animation="blur-resolve" />
        )
      }
      return (
        <span style={{ opacity: easeOutCubic(frame / 8) }}>
          {tokens(counted, item.emphasis).map((token, i) =>
            wordSpan(token, i, {})
          )}
        </span>
      )
    }
    case "tracking-in": {
      const e = easeOutQuart(frame / 22)
      return (
        <span
          style={{
            display: "inline-block",
            opacity: e,
            letterSpacing: `${((1 - e) * 0.4).toFixed(3)}em`,
            filter: `blur(${((1 - e) * 0.12).toFixed(3)}em)`,
          }}
        >
          {words.map((token, i) => wordSpan(token, i, {}))}
        </span>
      )
    }
  }
}

/**
 * "Ship {faster|safer}": the words roll through one slot. The slot is as
 * wide as the word showing, easing between widths as they swap, so the
 * words around it sit close at every moment (a slot sized to the longest
 * word left gaps). Widths are measured once, in em, so they hold at any
 * text size and stage scale.
 */
function KeywordSwap({
  before,
  words,
  after,
  frame,
  color,
}: {
  before: string
  words: string[]
  after: string
  frame: number
  color: string | undefined
}) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const [widths, setWidths] = useState<number[] | null>(null)
  const key = words.join("|")
  useLayoutEffect(() => {
    const box = measureRef.current
    if (!box) return
    const measure = () => {
      const size = parseFloat(getComputedStyle(box).fontSize) || 1
      setWidths(
        [...box.children].map(
          (child) => (child as HTMLElement).offsetWidth / size
        )
      )
    }
    measure()
    // Web fonts arriving later change the widths.
    let live = true
    document.fonts?.ready.then(() => live && measure())
    return () => {
      live = false
    }
  }, [key])

  // Each word holds for an equal share of the time on screen.
  const hold = 36
  const index = Math.floor(Math.max(0, frame - 12) / hold)
  const current = Math.min(words.length - 1, index)
  const swapT = easeOutCubic(((frame - 12) % hold) / 12)
  const first = easeOutCubic(frame / 12)
  const swapping = index > 0 && index < words.length && swapT < 1
  const width = widths
    ? swapping
      ? widths[current - 1]! + (widths[current]! - widths[current - 1]!) * swapT
      : widths[current]!
    : null

  return (
    <span style={{ opacity: first }}>
      {before}
      <span
        style={{
          display: "inline-block",
          position: "relative",
          verticalAlign: "bottom",
          overflow: "hidden",
          whiteSpace: "nowrap",
          width: width === null ? undefined : `${width.toFixed(4)}em`,
          color,
        }}
      >
        {/* Holds the line's height (and, before measuring, a width). */}
        <span style={{ visibility: "hidden" }}>
          {width === null
            ? words.reduce((a, b) => (b.length > a.length ? b : a))
            : "\u00a0"}
        </span>
        {words.map((word, i) => {
          const isCurrent = i === current
          const isPrevious = i === current - 1 && swapping
          const y = isCurrent
            ? index === 0
              ? (1 - first) * 0.8
              : (1 - swapT) * 0.8
            : isPrevious
              ? -swapT * 0.8
              : 1
          return (
            <span
              key={word}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translateY(${y.toFixed(3)}em)`,
                opacity: isCurrent ? 1 : isPrevious ? 1 - swapT : 0,
              }}
            >
              {word}
            </span>
          )
        })}
      </span>
      {after}
      {/* Off-stage copies of the words, for their widths. */}
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "nowrap",
          left: 0,
          top: 0,
        }}
      >
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </span>
    </span>
  )
}
