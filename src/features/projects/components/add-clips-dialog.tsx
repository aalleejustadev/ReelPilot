"use client"

import { CheckIcon, FilmIcon } from "lucide-react"
import { useState } from "react"

import { formatDuration } from "@/features/footage/client"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { LinkButton } from "@/shared/ui/link-button"

export type KitClip = {
  id: string
  name: string
  status: string
  durationMs: number | null
  posterUrl: string | null
}

/**
 * Pick clips from the project's brand kit. They're added in the order
 * picked (shown on each), after the clips already in the project.
 */
export function AddClipsDialog({
  open,
  onOpenChange,
  kitId,
  kitName,
  clips,
  room,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kitId: string
  kitName: string
  clips: KitClip[]
  /** How many more the project can hold. */
  room: number
  onAdd: (footageIds: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((other) => other !== id)
        : current.length < room
          ? [...current, id]
          : current
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicked([])
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose from footage</DialogTitle>
          <DialogDescription>
            Pick clips from {kitName}’s footage, in the order they should play.
            Each keeps its own edit.
          </DialogDescription>
        </DialogHeader>
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {kitName} has no footage yet.
          </p>
        ) : (
          <ul
            aria-label="Footage to add"
            className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
          >
            {clips.map((clip) => {
              const ready = clip.status === "READY"
              const order = picked.indexOf(clip.id)
              return (
                <li key={clip.id}>
                  <button
                    type="button"
                    aria-pressed={order >= 0}
                    disabled={!ready || (order < 0 && picked.length >= room)}
                    onClick={() => toggle(clip.id)}
                    className={cn(
                      "flex w-full flex-col overflow-hidden rounded-lg border bg-background text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                      order >= 0 && "border-ring ring-2 ring-ring/30"
                    )}
                  >
                    <span className="relative flex aspect-video w-full items-center justify-center bg-muted">
                      {clip.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed, expiring link
                        <img
                          src={clip.posterUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <FilmIcon
                          aria-hidden
                          className="size-5 text-muted-foreground"
                        />
                      )}
                      {order >= 0 && (
                        <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-primary font-mono text-xs text-primary-foreground">
                          {order + 1}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5 p-2">
                      <span className="truncate text-sm font-medium">
                        {clip.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {ready
                          ? clip.durationMs !== null
                            ? formatDuration(clip.durationMs)
                            : ""
                          : clip.status === "FAILED"
                            ? "Couldn’t be used"
                            : "Processing"}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <DialogFooter className="sm:justify-between">
          <LinkButton href={`/brand-kits/${kitId}/footage`} variant="ghost">
            Open the footage library
          </LinkButton>
          <Button
            type="button"
            disabled={picked.length === 0}
            onClick={() => {
              onAdd(picked)
              setPicked([])
            }}
          >
            <CheckIcon data-icon="inline-start" />
            {picked.length > 1
              ? `Add ${picked.length} clips`
              : picked.length === 1
                ? "Add 1 clip"
                : "Add clips"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
