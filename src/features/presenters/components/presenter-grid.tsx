"use client"

import { PauseIcon, PlayIcon, UserIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import type { PresenterCard } from "../queries"

/** 6200 → "0:06" */
function formatSeconds(ms: number) {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/**
 * The stock library. One audio element plays one sample at a time;
 * starting another stops the first.
 */
export function PresenterGrid({ presenters }: { presenters: PresenterCard[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Stop the sample when leaving the page.
  useEffect(() => () => audioRef.current?.pause(), [])

  async function toggle(presenter: PresenterCard) {
    const audio = (audioRef.current ??= new Audio())
    if (playing === presenter.id) {
      audio.pause()
      setPlaying(null)
      return
    }
    if (!presenter.sampleUrl) return
    audio.pause()
    audio.src = presenter.sampleUrl
    audio.onended = () => setPlaying(null)
    setLoading(presenter.id)
    try {
      await audio.play()
      setPlaying(presenter.id)
    } catch (error) {
      // Interrupted by another sample starting: not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setPlaying(null)
        toast.add({
          type: "error",
          title: `We couldn’t play ${presenter.name}’s voice. Try again.`,
        })
      }
    } finally {
      setLoading((current) => (current === presenter.id ? null : current))
    }
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {presenters.map((presenter) => {
        const isPlaying = playing === presenter.id
        const isLoading = loading === presenter.id
        return (
          <li key={presenter.id} className="flex">
            <Card className="w-full gap-0 overflow-hidden pt-0">
              <div className="flex aspect-square items-center justify-center bg-muted">
                {presenter.portraitUrl ? (
                  // Signed, short-lived storage URL (see brand-kits LogoField).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={presenter.portraitUrl}
                    alt={`Portrait of ${presenter.name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <UserIcon aria-hidden className="text-muted-foreground" />
                )}
              </div>
              <CardHeader className="gap-2 pt-5">
                <CardTitle>{presenter.name}</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  {presenter.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <CardDescription>Voice: {presenter.voiceLabel}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto pt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!presenter.sampleUrl}
                  aria-pressed={isPlaying}
                  aria-label={
                    isPlaying
                      ? `Pause ${presenter.name}’s voice`
                      : `Play ${presenter.name}’s voice`
                  }
                  onClick={() => void toggle(presenter)}
                >
                  {isLoading ? (
                    <Spinner data-icon="inline-start" />
                  ) : isPlaying ? (
                    <PauseIcon data-icon="inline-start" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  {!presenter.sampleUrl
                    ? "Sample coming soon"
                    : isPlaying
                      ? "Pause"
                      : "Hear voice"}
                  {presenter.sampleDurationMs && (
                    <span className="ml-auto font-mono text-muted-foreground">
                      {formatSeconds(presenter.sampleDurationMs)}
                    </span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
