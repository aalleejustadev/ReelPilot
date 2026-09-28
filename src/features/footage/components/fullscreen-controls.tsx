"use client"

import { MinimizeIcon, PauseIcon, PlayIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"
import { Slider } from "@/shared/ui/slider"

import { formatTimecode } from "../lib/format"

/** How long the controls stay after the pointer stops, while playing. */
const hideAfterMs = 2500

/**
 * The full-screen preview's controls, over the bottom of the video: play,
 * a scrubber and the time, and a way out. While playing they fade out
 * (with the pointer) once the pointer rests, like a video player's.
 */
export function FullscreenControls({
  isPlaying,
  currentMs,
  durationMs,
  onTogglePlay,
  onSeek,
  onExit,
}: {
  isPlaying: boolean
  /** Ad time. */
  currentMs: number
  durationMs: number
  onTogglePlay: () => void
  onSeek: (ms: number) => void
  onExit: () => void
}) {
  const [awake, setAwake] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Any pointer movement (or touch) on the stage wakes the controls.
  useEffect(() => {
    const wake = () => {
      setAwake(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setAwake(false), hideAfterMs)
    }
    wake()
    window.addEventListener("pointermove", wake)
    window.addEventListener("pointerdown", wake)
    window.addEventListener("keydown", wake)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener("pointermove", wake)
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("keydown", wake)
    }
  }, [])

  // Paused: always shown.
  const shown = awake || !isPlaying

  return (
    <>
      {/* Hide the pointer with the controls. */}
      {!shown && <style>{"body { cursor: none; }"}</style>}
      <div
        data-testid="fullscreen-controls"
        data-shown={shown || undefined}
        className={cn(
          "absolute inset-x-0 bottom-0 flex justify-center p-4 transition-opacity duration-300",
          shown ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex w-full max-w-3xl items-center gap-3 rounded-xl border bg-background/85 px-3 py-2 text-foreground shadow-lg backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onTogglePlay}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Slider
            aria-label="Position"
            className="flex-1"
            value={[Math.min(currentMs, durationMs)]}
            min={0}
            max={Math.max(1, durationMs)}
            step={100}
            // Shift+arrows jump a second (the default is 10 of these ms).
            largeStep={1000}
            onValueChange={(value) => {
              const ms = Array.isArray(value) ? value[0] : value
              if (typeof ms === "number") onSeek(ms)
            }}
          />
          <span className="font-mono text-sm whitespace-nowrap tabular-nums">
            {formatTimecode(currentMs)} / {formatTimecode(durationMs)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Exit full screen"
            onClick={onExit}
          >
            <MinimizeIcon />
          </Button>
        </div>
      </div>
    </>
  )
}
