"use client"

import {
  CreditCardIcon,
  DownloadIcon,
  LogOutIcon,
  PanelRightIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react"
import { useState } from "react"

import { cn } from "@/shared/lib/utils"
import { Avatar, AvatarFallback } from "@/shared/ui/avatar"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            type: "success",
            title: "Rendering 12 ads",
            description: "We'll email you when they're ready.",
          })
        }
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            type: "error",
            title: "Render failed",
            description: "We refunded 1 credit. Try again in a moment.",
          })
        }
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            type: "warning",
            title: "“#1 tool” is a superlative",
            description: "Some ad platforms restrict this claim.",
          })
        }
      >
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({ type: "loading", title: "Generating hooks…" })
        }
      >
        Loading
      </Button>
    </div>
  )
}

export function LoadingButtonDemo() {
  const [isPending, setIsPending] = useState(false)

  function render() {
    setIsPending(true)
    setTimeout(() => setIsPending(false), 1800)
  }

  return (
    <Button onClick={render} disabled={isPending}>
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <SparklesIcon data-icon="inline-start" />
      )}
      {isPending ? "Rendering…" : "Render 12 ads (12 credits)"}
    </Button>
  )
}

export function UserMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-10 gap-2 px-2" />}
      >
        <Avatar>
          <AvatarFallback>AM</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">Ali’s workspace</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>you@yourapp.com</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        <PanelRightIcon data-icon="inline-start" />
        Open inspector
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Hook segment</SheetTitle>
          <SheetDescription>
            Edits to captions and text overlays are free.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Field>
            <FieldLabel htmlFor="segment-caption">Caption</FieldLabel>
            <Input
              id="segment-caption"
              defaultValue="Stop editing ads by hand."
            />
            <FieldDescription>Shown for 0:00–0:03.</FieldDescription>
          </Field>
        </div>
        <SheetFooter>
          <Button>Save caption</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="outline" size="icon" aria-label="Download" />}
      >
        <DownloadIcon />
      </TooltipTrigger>
      <TooltipContent>Download 9:16, 4:5 and 1:1</TooltipContent>
    </Tooltip>
  )
}

const frames = [
  { hook: "I tried every ad tool. Then this.", status: "ready" },
  { hook: "Your app, explained in 20 seconds.", status: "ready" },
  { hook: "Stop paying $200 per UGC video.", status: "rendering" },
  { hook: "The old way vs the ReelPilot way.", status: "draft" },
  { hook: "3 features your users miss.", status: "failed" },
] as const

const statusLabel = {
  ready: "Ready",
  rendering: "Rendering",
  draft: "Draft",
  failed: "Failed",
} as const

/** The signature element (§12.4): 9:16 frames on a projector strip. */
export function ContactSheetDemo() {
  const [selected, setSelected] = useState<Set<number>>(new Set([0]))

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-projector p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-surface">
          <span className="tabular-nums">{selected.size}</span> of{" "}
          <span className="tabular-nums">{frames.length}</span> ads selected
        </p>
        <Button variant="chroma" size="sm" disabled={selected.size === 0}>
          Export {selected.size} {selected.size === 1 ? "ad" : "ads"}
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {frames.map((frame, index) => {
          const isSelected = selected.has(index)
          return (
            <button
              key={frame.hook}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(index)}
              className="group flex w-36 shrink-0 flex-col gap-2 text-left outline-none"
            >
              <div
                className={cn(
                  "relative aspect-[9/16] overflow-hidden rounded-lg bg-ink ring-2 ring-transparent transition-shadow group-focus-visible:ring-surface",
                  isSelected && "ring-chroma group-focus-visible:ring-chroma"
                )}
              >
                {/* Stand-in for real app footage */}
                <div className="absolute inset-x-3 top-6 flex flex-col gap-1.5">
                  <div className="h-2 w-2/3 rounded-sm bg-slate" />
                  <div className="h-16 rounded-sm bg-slate/60" />
                  <div className="h-2 w-1/2 rounded-sm bg-slate" />
                </div>
                {/* Corner presenter bubble */}
                <div className="absolute bottom-12 left-3 size-10 rounded-full border-2 border-surface bg-frame" />
                <p className="absolute inset-x-2 bottom-3 rounded-sm bg-ink/80 px-1.5 py-1 text-center text-[0.65rem] leading-tight font-semibold text-surface">
                  {frame.hook}
                </p>
                <Badge
                  variant={frame.status}
                  className="absolute top-2 right-2"
                >
                  {statusLabel[frame.status]}
                </Badge>
              </div>
              <span className="line-clamp-2 text-xs text-frame">
                {frame.hook}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
