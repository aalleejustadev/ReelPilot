"use client"

import { KeyboardIcon } from "lucide-react"

import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

/** The editor's keys, grouped. `mod` is ⌘ on a Mac, Ctrl elsewhere. */
function shortcuts(mod: string) {
  return [
    {
      group: "Playback",
      keys: [
        ["Space", "Play or pause"],
        ["J", "Play backwards (press again to go faster)"],
        ["K", "Pause"],
        ["L", "Play forwards (press again to go faster)"],
        [", / .", "One frame back / forward"],
        ["← / →", "Move the playhead 0.1s (Shift: 1s), on the timeline"],
        ["F", "Full screen (Esc to leave)"],
      ],
    },
    {
      group: "Editing",
      keys: [
        ["S", "Split the footage at the playhead"],
        [`${mod}Z`, "Undo"],
        [mod === "⌘" ? "⇧⌘Z" : "Ctrl+Y", "Redo"],
        ["Delete", "Remove the selected text or graphic"],
        ["← / →", "Nudge a selected key moment (Shift: 1s)"],
      ],
    },
    { group: "Help", keys: [["?", "Show these shortcuts"]] },
  ]
}

export function ShortcutsDialog({
  open,
  onOpenChange,
  mac,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mac: boolean
}) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Keyboard shortcuts"
              aria-keyshortcuts="Shift+/"
              onClick={() => onOpenChange(true)}
            />
          }
        >
          <KeyboardIcon />
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Edit without reaching for the mouse.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {shortcuts(mac ? "⌘" : "Ctrl+").map(({ group, keys }) => (
              <section key={group} aria-label={group}>
                <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {group}
                </h3>
                <dl className="flex flex-col gap-1.5">
                  {keys.map(([key, what]) => (
                    <div
                      key={`${key}-${what}`}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <dt>
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {key}
                        </kbd>
                      </dt>
                      <dd className="text-right text-muted-foreground">
                        {what}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
