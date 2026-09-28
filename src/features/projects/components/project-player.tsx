"use client"

import { Player, type PlayerRef } from "@remotion/player"
import { MaximizeIcon, PauseIcon, PlayIcon, SquareIcon } from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import {
  formatTimecode,
  FullscreenControls,
  stageAspects,
  type StageAspect,
} from "@/features/footage/client"
import {
  framesFor,
  stageFps,
  stageSizes,
} from "@/remotion/compositions/FootageStage"
import {
  ProjectStage,
  projectDurationMs,
  type ProjectStageProps,
} from "@/remotion/compositions/ProjectStage"
import { useFullscreen, useSpaceToPlay } from "@/shared/hooks/use-player-keys"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"
import { Slider } from "@/shared/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

const noSubscribe = () => () => {}
const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * The whole project playing: every clip with its own edit, joined by the
 * transitions (the composition M5 exports). Its time is reported so the
 * clip strip can show which clip is on.
 */
export function ProjectPlayer({
  input,
  onTimeChange,
  seekRef,
}: {
  input: Omit<ProjectStageProps, "preview" | "playing" | "reduceMotion">
  onTimeChange?: (ms: number) => void
  /** Lets the page jump to a time (a clip's start). */
  seekRef?: React.RefObject<((ms: number) => void) | null>
}) {
  const playerRef = useRef<PlayerRef>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState<StageAspect>("16:9")
  // Where playback was when the shape changed (a new Player resumes there).
  const [resumeFrame, setResumeFrame] = useState(0)
  const [isPlaying, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const lastFrame = useRef(0)
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false
  )
  // Read only after hydration (the server can't know).
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  )
  const durationMs = projectDurationMs(input)
  const size = stageSizes[aspect]

  const inputProps: ProjectStageProps = useMemo(
    () => ({ ...input, preview: true, playing: isPlaying, reduceMotion }),
    [input, isPlaying, reduceMotion]
  )

  const seek = useCallback((ms: number) => {
    const frame = Math.round((ms / 1000) * stageFps)
    playerRef.current?.seekTo(frame)
    setCurrentMs(ms)
  }, [])
  useEffect(() => {
    if (seekRef) seekRef.current = seek
  }, [seek, seekRef])

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) {
      player.pause()
      return
    }
    // From the end, play again from the start.
    if ((player.getCurrentFrame() / stageFps) * 1000 >= durationMs - 50)
      player.seekTo(0)
    player.play()
  }, [durationMs])
  useSpaceToPlay(togglePlay)
  const { fullscreen, enter, exit } = useFullscreen(boxRef)

  // Time and play state from the Player (10×/s is plenty for the UI).
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    let lastTenth = -1
    const report = (frame: number) => {
      lastFrame.current = frame
      const ms = (frame / stageFps) * 1000
      const tenth = Math.floor(ms / 100)
      if (tenth === lastTenth) return
      lastTenth = tenth
      setCurrentMs(ms)
      onTimeChange?.(ms)
    }
    const onFrame = ({ detail }: { detail: { frame: number } }) =>
      report(detail.frame)
    const onPlay = () => setPlaying(true)
    const onStop = () => setPlaying(false)
    // Stopped on the last frame, which starts a frame before the end: the
    // clock reads the full length, as players do.
    const onEnded = () => {
      setPlaying(false)
      setCurrentMs(durationMs)
      onTimeChange?.(durationMs)
    }
    player.addEventListener("frameupdate", onFrame)
    player.addEventListener("seeked", onFrame)
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onStop)
    player.addEventListener("ended", onEnded)
    return () => {
      player.removeEventListener("frameupdate", onFrame)
      player.removeEventListener("seeked", onFrame)
      player.removeEventListener("play", onPlay)
      player.removeEventListener("pause", onStop)
      player.removeEventListener("ended", onEnded)
    }
  }, [aspect, onTimeChange, hydrated, durationMs])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={boxRef}
        data-testid="project-stage-box"
        data-fullscreen={fullscreen || undefined}
        className={cn(
          fullscreen
            ? "fixed inset-0 z-50 bg-black"
            : "h-[45vh] bg-muted/60 p-4 sm:p-6 lg:h-auto lg:min-h-0 lg:flex-1"
        )}
      >
        <div className="[container-type:size] flex size-full items-center justify-center">
          <div
            data-testid="project-stage"
            className={cn(
              "relative overflow-hidden select-none",
              !fullscreen && "rounded-lg shadow-sm"
            )}
            style={{
              aspectRatio: stageAspects[aspect],
              width: `min(100cqw, calc(100cqh * ${size.width} / ${size.height}))`,
            }}
          >
            {hydrated && (
              <Player
                // A new shape is a new composition size.
                key={aspect}
                ref={playerRef}
                component={ProjectStage}
                inputProps={inputProps}
                durationInFrames={framesFor(durationMs)}
                compositionWidth={size.width}
                compositionHeight={size.height}
                fps={stageFps}
                initialFrame={Math.min(
                  resumeFrame,
                  Math.max(0, framesFor(durationMs) - 1)
                )}
                controls={false}
                clickToPlay={false}
                doubleClickToFullscreen={false}
                spaceKeyToPlayOrPause={false}
                moveToBeginningWhenEnded={false}
                acknowledgeRemotionLicense
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>
        </div>
        {fullscreen && (
          <FullscreenControls
            isPlaying={isPlaying}
            currentMs={currentMs}
            durationMs={durationMs}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onExit={exit}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t bg-card px-3 py-2 sm:gap-3 sm:px-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={togglePlay}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Stop"
          onClick={() => {
            playerRef.current?.pause()
            seek(0)
          }}
        >
          <SquareIcon />
        </Button>
        <Slider
          aria-label="Position"
          className="min-w-24 flex-1"
          value={[Math.min(currentMs, durationMs)]}
          min={0}
          max={Math.max(1, durationMs)}
          step={100}
          // Shift+arrows jump a second (the default is 10 of these ms).
          largeStep={1000}
          onValueChange={(value) => {
            const ms = Array.isArray(value) ? value[0] : value
            if (typeof ms === "number") seek(ms)
          }}
        />
        <span
          className="font-mono text-sm whitespace-nowrap tabular-nums"
          aria-label="Playback position"
        >
          {formatTimecode(currentMs)} / {formatTimecode(durationMs)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Full screen"
          title="Full screen (F)"
          onClick={enter}
        >
          <MaximizeIcon />
        </Button>
        <ToggleGroup
          aria-label="Preview shape"
          variant="outline"
          size="sm"
          value={[aspect]}
          onValueChange={(values) => {
            const next = values[0] as StageAspect | undefined
            if (!next) return
            setResumeFrame(lastFrame.current)
            setAspect(next)
          }}
        >
          {(Object.keys(stageAspects) as StageAspect[]).map((shape) => (
            <ToggleGroupItem key={shape} value={shape} className="font-mono">
              {shape}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
