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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Checkbox } from "@/shared/ui/checkbox"
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
        onClick={() => toast.add({ type: "loading", title: "Writing hooks…" })}
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
      <DropdownMenuTrigger render={<Button variant="ghost" />}>
        <Avatar size="sm">
          <AvatarFallback>AM</AvatarFallback>
        </Avatar>
        Ali’s workspace
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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

type AdStatus = "ready" | "rendering" | "draft" | "failed"

/** Default badge variants; a coloured dot carries the palette meaning. */
export function StatusBadge({ status }: { status: AdStatus }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="outline">
          <span className="size-1.5 rounded-full bg-chroma" aria-hidden />
          Ready
        </Badge>
      )
    case "rendering":
      return (
        <Badge variant="outline">
          <span
            className="size-1.5 animate-pulse rounded-full bg-tally"
            aria-hidden
          />
          Rendering
        </Badge>
      )
    case "draft":
      return <Badge variant="secondary">Draft</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
  }
}

const ads: {
  hook: string
  angle: string
  duration: string
  status: AdStatus
}[] = [
  {
    hook: "I tried every ad tool. Then this.",
    angle: "I tried everything",
    duration: "0:24",
    status: "ready",
  },
  {
    hook: "Your app, explained in 20 seconds.",
    angle: "Feature demo",
    duration: "0:20",
    status: "ready",
  },
  {
    hook: "Stop paying $200 per UGC video.",
    angle: "Problem / solution",
    duration: "0:27",
    status: "rendering",
  },
  {
    hook: "The old way vs the new way.",
    angle: "Old vs new",
    duration: "0:22",
    status: "draft",
  },
  {
    hook: "3 features your users miss.",
    angle: "Feature demo",
    duration: "0:18",
    status: "failed",
  },
]

/** Stand-in for a real frame of app footage with a corner presenter. */
function FramePreview({ duration }: { duration: string }) {
  return (
    <div className="relative aspect-9/16 overflow-hidden rounded-lg bg-projector">
      <div className="absolute inset-x-3 top-8 flex flex-col gap-2 rounded-md bg-surface/10 p-2">
        <div className="h-1.5 w-1/2 rounded-full bg-surface/30" />
        <div className="h-12 rounded-sm bg-surface/15" />
        <div className="h-1.5 w-2/3 rounded-full bg-surface/30" />
        <div className="h-1.5 w-1/3 rounded-full bg-surface/30" />
      </div>
      <div className="absolute bottom-14 left-3 size-9 rounded-full bg-frame ring-2 ring-surface" />
      {/* Caption bars */}
      <div className="absolute inset-x-6 bottom-5 flex flex-col items-center gap-1.5">
        <div className="h-2 w-full rounded-full bg-surface/80" />
        <div className="h-2 w-2/3 rounded-full bg-surface/80" />
      </div>
      <span className="absolute top-2 right-2 rounded-sm bg-ink/70 px-1 font-mono text-[10px] text-surface">
        {duration}
      </span>
    </div>
  )
}

/** Contact sheet (§12.4): variants of one campaign, selectable for export. */
export function ContactSheetDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set([ads[0].hook]))

  function setChecked(hook: string, isChecked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (isChecked) next.add(hook)
      else next.delete(hook)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spring launch</CardTitle>
        <CardDescription>
          <span className="font-mono">{ads.length}</span> ads · 9:16 · Meta and
          TikTok
        </CardDescription>
        <CardAction>
          <Button size="sm" disabled={selected.size === 0}>
            <DownloadIcon data-icon="inline-start" />
            Export {selected.size || ""} {selected.size === 1 ? "ad" : "ads"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {ads.map((ad) => {
            const isSelected = selected.has(ad.hook)
            return (
              <label key={ad.hook} className="group flex flex-col gap-3">
                <div
                  className={cn(
                    "relative rounded-xl p-0.5 ring-1 ring-transparent transition-shadow",
                    isSelected
                      ? "ring-2 ring-primary"
                      : "group-hover:ring-border"
                  )}
                >
                  <FramePreview duration={ad.duration} />
                  <div className="absolute top-2.5 left-2.5 flex rounded-sm bg-background p-0.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        setChecked(ad.hook, checked)
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 px-0.5">
                  <span className="line-clamp-2 text-sm leading-snug font-medium">
                    {ad.hook}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusBadge status={ad.status} />
                    <span className="truncate text-xs text-muted-foreground">
                      {ad.angle}
                    </span>
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
