import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"

import {
  splitAreas,
  splitInMs,
  splitOutMs,
  type GraphicItem,
  type TextAnimation,
  type TextItem,
} from "@/shared/motion"

import { AnimatedText, type Colors, type StageFonts } from "./TextLayer"

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3

/** A layout's words as a text item, so they animate like any text. */
const asText = (
  item: GraphicItem,
  text: string,
  role: TextItem["role"]
): TextItem => ({
  id: item.id,
  atMs: item.atMs,
  durationMs: Math.max(600, item.durationMs),
  text,
  role,
  animation: null,
  x: 0.5,
  y: 0.5,
  align: "center",
  emphasis: "",
  track: item.track,
  size: 1,
})

type LayoutProps = {
  item: GraphicItem
  frames: number
  colors: Colors
  fonts: StageFonts
  background: string
  animation: TextAnimation
}

/**
 * A text slide: the stage's own background over everything below it, a
 * short accent rule, the title in the video's text style and a line under
 * it. It fades in over the video and out again, like a title card.
 */
export function TextSlide({
  item,
  frames,
  colors,
  fonts,
  background,
  animation,
}: LayoutProps) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const su = Math.min(width, height) / 100
  const tall = height > width
  const fade = Math.min(
    easeOutCubic(frame / 9),
    easeOutCubic((frames - frame) / 9)
  )
  const words = Math.min(1, easeOutCubic((frames - frame) / 7))
  const rule = easeOutCubic((frame - 4) / 14)
  const line = easeOutCubic((frame - 14) / 14)
  return (
    <AbsoluteFill
      data-item-id={item.id}
      data-layout="slide"
      style={{
        background,
        opacity: fade,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 2.4 * su,
        textAlign: "center",
        padding: `0 ${tall ? 8 : 12}%`,
      }}
    >
      <span
        style={{
          width: 7 * su,
          height: 0.7 * su,
          borderRadius: su,
          background: colors.stageAccent,
          transform: `scaleX(${rule.toFixed(3)})`,
          opacity: words,
        }}
      />
      <div
        style={{
          fontFamily: fonts.heading,
          fontWeight: fonts.headingWeight,
          fontSize: (tall ? 10 : 9) * su * item.textSize,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: colors.base,
          opacity: words,
          textWrap: "balance",
        }}
      >
        <AnimatedText
          item={asText(item, item.text || "Your big idea", "headline")}
          animation={animation}
          frame={frame}
          colors={colors}
        />
      </div>
      {item.secondary && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: (tall ? 4.2 : 3.6) * su * item.secondarySize,
            lineHeight: 1.35,
            color: colors.base,
            opacity: 0.78 * line * words,
            transform: `translateY(${((1 - line) * 1.2 * su).toFixed(2)}px)`,
            maxWidth: "70ch",
            textWrap: "balance",
          }}
        >
          {item.secondary}
        </div>
      )}
    </AbsoluteFill>
  )
}

/**
 * A split's words: the half of the stage the video left, the title and
 * line set in a column. They come in once the frame has glided aside and
 * leave before it glides back.
 */
export function SplitText({
  item,
  frames,
  colors,
  fonts,
  animation,
}: Omit<LayoutProps, "background">) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const su = Math.min(width, height) / 100
  const { text: area, stacked } = splitAreas({ width, height, side: item.side })
  // Words start when the frame is about halfway into its glide.
  const delay = Math.round(
    ((Math.min(splitInMs, (frames / fps) * 500) * 0.5) / 1000) * fps
  )
  const outFrames = Math.max(
    4,
    Math.round(
      ((Math.min(splitOutMs, (frames / fps) * 500) * 0.7) / 1000) * fps
    )
  )
  const shown = Math.min(1, easeOutCubic((frames - frame) / outFrames))
  const line = easeOutCubic((frame - delay - 10) / 14)
  const onLeft = area.x === 0 && !stacked
  return (
    <div
      data-item-id={item.id}
      data-layout="split"
      style={{
        position: "absolute",
        left: area.x,
        top: area.y,
        width: area.w,
        height: area.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: stacked ? "center" : "flex-start",
        textAlign: stacked ? "center" : "left",
        gap: 2 * su,
        // The seam side sits tighter, so the words belong to the video.
        padding: stacked
          ? `${4 * su}px 8%`
          : onLeft
            ? `0 3% 0 9%`
            : `0 9% 0 3%`,
        opacity: shown,
      }}
    >
      <div
        style={{
          fontFamily: fonts.heading,
          fontWeight: fonts.headingWeight,
          fontSize: (stacked ? 7 : 6) * su * item.textSize,
          lineHeight: 1.06,
          letterSpacing: "-0.02em",
          color: colors.base,
          textShadow: colors.shadow
            ? "0 0.04em 0.35em rgb(0 0 0 / 0.3)"
            : undefined,
          textWrap: "balance",
        }}
      >
        <AnimatedText
          item={asText(item, item.text || "Say what it does", "headline")}
          animation={animation}
          frame={frame - delay}
          colors={colors}
        />
      </div>
      {item.secondary && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: (stacked ? 3.4 : 2.7) * su * item.secondarySize,
            lineHeight: 1.4,
            color: colors.base,
            opacity: 0.78 * line,
            transform: `translateY(${((1 - line) * 1.2 * su).toFixed(2)}px)`,
            textWrap: "pretty",
          }}
        >
          {item.secondary}
        </div>
      )}
    </div>
  )
}
