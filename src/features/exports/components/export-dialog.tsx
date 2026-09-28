"use client"

import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  RefreshCwIcon,
  Share2Icon,
} from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { Button, buttonVariants } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/shared/ui/progress"
import { Separator } from "@/shared/ui/separator"
import { Spinner } from "@/shared/ui/spinner"
import { Switch } from "@/shared/ui/switch"
import { toast } from "@/shared/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group"

import { exportPanel, setShareLink, startExport } from "../actions"
import type { ExportPanel } from "../queries"
import { exportShapes, type ExportShape, type ExportTarget } from "../schema"

const shapeNames: Record<ExportShape, string> = {
  "16:9": "Landscape",
  "9:16": "Portrait",
  "1:1": "Square",
}

/** How often the dialog reads a running export's progress. */
const pollMs = 2000

/** 10896434 → "10.4 MB". */
function formatSize(bytes: number) {
  const mb = bytes / 1024 / 1024
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const isRunning = (status: string | undefined) =>
  status === "QUEUED" || status === "RENDERING"

/**
 * "Export": the clip's or video's MP4 in any shape (rendered by the
 * worker, then downloaded), and a public link anyone can watch, which
 * plays the newest export. Viewers can download and copy, not change.
 */
export function ExportDialog({
  target,
  defaultShape = "16:9",
  canEdit,
}: {
  target: ExportTarget
  /** The shape the editor shows now. */
  defaultShape?: ExportShape
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [shape, setShape] = useState<ExportShape>(defaultShape)
  const [panel, setPanel] = useState<ExportPanel | null>(null)
  const [isStarting, startTransition] = useTransition()
  const [isSharing, shareTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const result = await exportPanel(target)
    if (result.ok) setPanel(result.data)
    else toast.add({ type: "error", title: result.error.message })
  }, [target])

  // Follow a running export, open or closed (the button shows progress).
  const running = exportShapes.find((each) =>
    isRunning(panel?.exports[each]?.status)
  )
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => void load(), pollMs)
    return () => clearInterval(timer)
  }, [running, load])

  const view = panel?.exports[shape]
  const file = view?.file ?? null
  const runningHere = isRunning(view?.status)
  const shareUrl =
    panel?.share?.enabled && typeof window !== "undefined"
      ? `${window.location.origin}/v/${panel.share.token}`
      : null
  const anyFile = exportShapes.some((each) => panel?.exports[each]?.file)

  function exportNow() {
    startTransition(async () => {
      const result = await startExport({ target, shape })
      if (result.ok) setPanel(result.data)
      else toast.add({ type: "error", title: result.error.message })
    })
  }

  function share(enabled: boolean) {
    shareTransition(async () => {
      const result = await setShareLink({ target, enabled })
      if (result.ok) setPanel(result.data)
      else toast.add({ type: "error", title: result.error.message })
    })
  }

  async function copy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.add({
        type: "error",
        title: "Couldn’t copy. Select the link and copy it.",
      })
    }
  }

  const runningProgress = running
    ? Math.round((panel?.exports[running]?.progress ?? 0) * 100)
    : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Opens on the shape the editor shows, with fresh state (the edit
        // may have changed).
        if (next) {
          setShape(defaultShape)
          void load()
        }
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button />}>
        {running ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Share2Icon data-icon="inline-start" />
        )}
        {/* Icon only on phones; the name is still spoken. */}
        <span className="max-sm:sr-only">
          {running ? `Exporting ${runningProgress}%` : "Export"}
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export and share</DialogTitle>
          <DialogDescription>
            Download an MP4, or share a link anyone can watch.
          </DialogDescription>
        </DialogHeader>

        {!panel ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <FieldGroup>
            <FieldSet>
              <FieldLegend>MP4</FieldLegend>
              <ToggleGroup
                aria-label="Shape"
                variant="outline"
                value={[shape]}
                onValueChange={(values) => {
                  const next = values[0] as ExportShape | undefined
                  if (next) setShape(next)
                }}
                className="w-full"
              >
                {exportShapes.map((each) => (
                  <ToggleGroupItem
                    key={each}
                    value={each}
                    className="flex-1 flex-col gap-0 py-5"
                  >
                    <span>{shapeNames[each]}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {each}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {runningHere ? (
                <Progress value={Math.round((view?.progress ?? 0) * 100)}>
                  <ProgressLabel>
                    {view?.status === "QUEUED"
                      ? "Waiting to start…"
                      : "Exporting your video…"}
                  </ProgressLabel>
                  <ProgressValue />
                </Progress>
              ) : (
                <>
                  {view?.status === "FAILED" && view.errorMessage && (
                    <Alert variant="destructive">
                      <AlertCircleIcon />
                      <AlertTitle>The export didn’t finish</AlertTitle>
                      <AlertDescription>{view.errorMessage}</AlertDescription>
                    </Alert>
                  )}
                  {panel.notReady && canEdit && !file && (
                    <p className="text-sm text-muted-foreground">
                      {panel.notReady}
                    </p>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {file && (
                  // A real link: the signed URL downloads under the video's name.
                  <a
                    href={file.downloadUrl}
                    download
                    className={buttonVariants({
                      variant: file.current || !canEdit ? "default" : "outline",
                    })}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    Download MP4
                    {file.sizeBytes ? ` · ${formatSize(file.sizeBytes)}` : ""}
                  </a>
                )}
                {canEdit && !runningHere && (!file || !file.current) && (
                  <Button
                    type="button"
                    disabled={isStarting || panel.notReady !== null}
                    onClick={exportNow}
                  >
                    {isStarting ? (
                      <Spinner data-icon="inline-start" />
                    ) : file ? (
                      <RefreshCwIcon data-icon="inline-start" />
                    ) : null}
                    {file ? "Export again" : "Export MP4"}
                  </Button>
                )}
              </div>
              {file && !file.current && (
                <FieldDescription>
                  You’ve edited this since the last export.
                  {canEdit ? " Export again to include your changes." : ""}
                </FieldDescription>
              )}
            </FieldSet>

            <Separator />

            <FieldSet>
              <FieldLegend>Share link</FieldLegend>
              {canEdit && (
                <Field orientation="horizontal">
                  <Switch
                    id="share-link"
                    checked={panel.share?.enabled ?? false}
                    disabled={isSharing}
                    onCheckedChange={share}
                  />
                  <FieldLabel htmlFor="share-link">
                    Anyone with the link can watch
                  </FieldLabel>
                </Field>
              )}
              {shareUrl ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      aria-label="Share link"
                      value={shareUrl}
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copy()}
                    >
                      {copied ? (
                        <CheckIcon data-icon="inline-start" />
                      ) : (
                        <CopyIcon data-icon="inline-start" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <FieldDescription>
                    {anyFile
                      ? "It plays your newest export, no account needed."
                      : "It plays your newest export: export once so there’s something to watch."}
                  </FieldDescription>
                </>
              ) : (
                !canEdit && (
                  <FieldDescription>
                    Sharing is off for this video.
                  </FieldDescription>
                )
              )}
            </FieldSet>
          </FieldGroup>
        )}
      </DialogContent>
    </Dialog>
  )
}
