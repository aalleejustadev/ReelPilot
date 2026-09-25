"use client"

import { CircleIcon, FlagIcon, MonitorIcon, SquareIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Field, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/shared/ui/progress"
import { toast } from "@/shared/ui/toast"

import { formatDuration, videoTypeOf } from "../lib/format"
import { formatMinutes } from "../lib/limits"
import {
  canRecordScreen,
  copyStylesInto,
  documentPictureInPicture,
  pickRecordingType,
  recordingName,
} from "../lib/recorder"
import { sendFootage } from "../lib/send-footage"
import { footageLimits } from "../schema"

type Stage =
  | { name: "intro" }
  | { name: "countdown"; seconds: number }
  | { name: "recording" }
  | { name: "review"; blob: Blob; url: string; durationMs: number }
  | { name: "uploading"; progress: number }

const noSubscribe = () => () => {}

/**
 * Guided screen recording: tips → pick a screen → 3-2-1 → record with
 * "Mark moment" (floating over other apps in Chrome/Edge) → preview → upload
 * through the same path as file uploads. No microphone: ads get a voiceover.
 */
export function ScreenRecorder({
  kitId,
  maxBytes,
  maxDurationSeconds,
}: {
  kitId: string
  maxBytes: number
  maxDurationSeconds: number
}) {
  const router = useRouter()
  // Known only in the browser; false during server rendering.
  const supported = useSyncExternalStore(
    noSubscribe,
    canRecordScreen,
    () => false
  )
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>({ name: "intro" })
  const [elapsedMs, setElapsedMs] = useState(0)
  const [marks, setMarks] = useState<number[]>([])
  const [name, setName] = useState("")
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const bytes = useRef(0)
  const pipRef = useRef<Window | null>(null)

  // Tick the timer; stop at the plan's length.
  useEffect(() => {
    if (stage.name !== "recording") return
    const timer = setInterval(() => {
      const ms = Date.now() - startedAt.current
      setElapsedMs(ms)
      if (
        ms >= maxDurationSeconds * 1000 &&
        recorder.current?.state === "recording"
      ) {
        recorder.current.stop()
      }
    }, 200)
    return () => clearInterval(timer)
  }, [stage.name, maxDurationSeconds])

  // Release the screen and the mini window if the page goes away mid-take.
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop())
      pipRef.current?.close()
    },
    []
  )

  function cleanUp() {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    pipRef.current?.close()
    pipRef.current = null
    setPipWindow(null)
  }

  async function chooseScreen() {
    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      })
    } catch {
      // The user closed the picker, or the browser refused.
      return
    }
    stream.current = media
    // "Stop sharing" in the browser's own bar ends the recording too.
    media.getVideoTracks()[0]?.addEventListener("ended", stopRecording)
    await openMiniWindow()
    for (const seconds of [3, 2, 1]) {
      setStage({ name: "countdown", seconds })
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    startRecording(media)
  }

  async function openMiniWindow() {
    const pip = documentPictureInPicture()
    if (!pip) return
    try {
      const win = await pip.requestWindow({ width: 280, height: 140 })
      copyStylesInto(win.document)
      win.addEventListener("pagehide", () => {
        pipRef.current = null
        setPipWindow(null)
      })
      pipRef.current = win
      setPipWindow(win)
    } catch {
      // Not allowed right now: the dialog's own buttons still work.
    }
  }

  function startRecording(media: MediaStream) {
    const type = pickRecordingType()
    const chunks: Blob[] = []
    const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined)
    bytes.current = 0
    rec.ondataavailable = (event) => {
      if (event.data.size === 0) return
      chunks.push(event.data)
      bytes.current += event.data.size
      // Leave headroom under the plan's size cap.
      if (bytes.current > maxBytes * 0.95) stopRecording()
    }
    rec.onstop = () => {
      cleanUp()
      const blob = new Blob(chunks, {
        type: rec.mimeType || type || "video/webm",
      })
      const durationMs = Date.now() - startedAt.current
      setStage({
        name: "review",
        blob,
        url: URL.createObjectURL(blob),
        durationMs,
      })
      setName(recordingName())
      window.focus()
    }
    recorder.current = rec
    setMarks([])
    setElapsedMs(0)
    startedAt.current = Date.now()
    rec.start(1000)
    setStage({ name: "recording" })
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop()
  }

  function markMoment() {
    const atMs = Date.now() - startedAt.current
    setMarks((current) =>
      current.length < footageLimits.recordedMarks
        ? [...current, atMs]
        : current
    )
  }

  function reset() {
    if (stage.name === "review") URL.revokeObjectURL(stage.url)
    cleanUp()
    setStage({ name: "intro" })
  }

  async function upload() {
    if (stage.name !== "review") return
    const { blob, url } = stage
    setStage({ name: "uploading", progress: 0 })
    const error = await sendFootage({
      kitId,
      file: blob,
      contentType: videoTypeOf(blob),
      name: name || recordingName(),
      source: "RECORDING",
      recordedMarksMs: marks,
      onProgress: (progress) => setStage({ name: "uploading", progress }),
    })
    URL.revokeObjectURL(url)
    if (error) {
      toast.add({ type: "error", title: error })
      setStage({ name: "intro" })
      return
    }
    toast.add({
      type: "success",
      title: "Recording uploaded",
      description: "We’re converting it and finding key moments.",
    })
    setOpen(false)
    setStage({ name: "intro" })
    router.refresh()
  }

  const isBusy = stage.name !== "intro" && stage.name !== "review"
  const controls = (
    <RecordingControls
      elapsedMs={elapsedMs}
      marks={marks.length}
      onMark={markMoment}
      onStop={stopRecording}
    />
  )

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Screen recording works in desktop Chrome, Edge, Firefox and Safari. On
        this device, upload a video instead.
      </p>
    )
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <MonitorIcon data-icon="inline-start" />
        Record your screen
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isBusy) return
          if (!next) reset()
          setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record your screen</DialogTitle>
            <DialogDescription>
              {stage.name === "review"
                ? "Check your recording, then upload it."
                : `Up to ${formatMinutes(maxDurationSeconds)}. No sound is recorded; your ads get a voiceover.`}
            </DialogDescription>
          </DialogHeader>

          {stage.name === "intro" && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              <li>Open your app in another tab or window first.</li>
              <li>Show one feature at a time, and pause on each screen.</li>
              <li>Move the mouse slowly; click deliberately.</li>
              <li>
                Press <strong>Mark moment</strong> when something worth showing
                happens.
              </li>
            </ul>
          )}

          {stage.name === "countdown" && (
            <p
              className="py-6 text-center font-mono text-5xl font-semibold"
              aria-live="assertive"
            >
              {stage.seconds}
            </p>
          )}

          {stage.name === "recording" && (
            <div className="flex flex-col gap-3">
              {pipWindow && (
                <p className="text-sm text-muted-foreground">
                  The recording controls float over your other windows, so you
                  can mark moments while you work.
                </p>
              )}
              {controls}
            </div>
          )}

          {stage.name === "review" && (
            <div className="flex flex-col gap-4">
              <video
                src={stage.url}
                controls
                playsInline
                className="max-h-64 w-full rounded-md bg-projector"
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">
                  {formatDuration(stage.durationMs)}
                </span>
                {marks.length > 0 &&
                  ` · ${marks.length} marked ${marks.length === 1 ? "moment" : "moments"}`}
              </p>
              <Field>
                <FieldLabel htmlFor="recording-name">Name</FieldLabel>
                <Input
                  id="recording-name"
                  value={name}
                  maxLength={footageLimits.name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            </div>
          )}

          {stage.name === "uploading" && (
            <Progress value={Math.round(stage.progress * 100)}>
              <ProgressLabel>Uploading your recording</ProgressLabel>
              <ProgressValue />
            </Progress>
          )}

          <DialogFooter>
            {stage.name === "intro" && (
              <Button type="button" onClick={chooseScreen}>
                <CircleIcon data-icon="inline-start" />
                Start recording
              </Button>
            )}
            {stage.name === "review" && (
              <>
                <Button type="button" variant="outline" onClick={reset}>
                  Record again
                </Button>
                <Button type="button" onClick={upload}>
                  Upload recording
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {pipWindow &&
        stage.name === "recording" &&
        createPortal(
          <div className="flex h-screen items-center justify-center p-3">
            {controls}
          </div>,
          pipWindow.document.body
        )}
    </>
  )
}

function RecordingControls({
  elapsedMs,
  marks,
  onMark,
  onStop,
}: {
  elapsedMs: number
  marks: number
  onMark: () => void
  onStop: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span
            aria-hidden
            className="size-2.5 animate-pulse rounded-full bg-tally motion-reduce:animate-none"
          />
          Recording
        </span>
        <span className="font-mono text-sm" aria-label="Time recorded">
          {formatDuration(elapsedMs)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onMark}
        >
          <FlagIcon data-icon="inline-start" />
          Mark moment{marks > 0 ? ` (${marks})` : ""}
        </Button>
        <Button type="button" variant="destructive" onClick={onStop}>
          <SquareIcon data-icon="inline-start" />
          Stop
        </Button>
      </div>
    </div>
  )
}
