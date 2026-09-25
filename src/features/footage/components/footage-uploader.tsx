"use client"

import { UploadIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/shared/ui/progress"
import { toast } from "@/shared/ui/toast"

import { videoTypeOf } from "../lib/format"
import { formatBytes } from "../lib/limits"
import { sendFootage } from "../lib/send-footage"
import { footageTypes } from "../schema"

const accept = Object.keys(footageTypes).join(",")

/** "Upload video": checks the file here first, then sends it to storage. */
export function FootageUploader({
  kitId,
  maxBytes,
  disabled,
}: {
  kitId: string
  maxBytes: number
  disabled: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<{
    name: string
    progress: number
    controller: AbortController
  } | null>(null)

  async function start(file: File) {
    // Instant feedback; the server checks the same rules again.
    const type = videoTypeOf(file)
    if (!(type in footageTypes)) {
      toast.add({ type: "error", title: "Upload an MP4, MOV or WebM video." })
      return
    }
    if (file.size > maxBytes) {
      toast.add({
        type: "error",
        title: `Your footage is larger than ${formatBytes(maxBytes)}. Trim it or upload a smaller clip.`,
      })
      return
    }

    const controller = new AbortController()
    setUpload({ name: file.name, progress: 0, controller })
    const error = await sendFootage({
      kitId,
      file,
      contentType: type,
      name: file.name,
      source: "UPLOAD",
      signal: controller.signal,
      onProgress: (progress) =>
        setUpload((current) => current && { ...current, progress }),
    })
    setUpload(null)
    if (error) {
      toast.add({ type: "error", title: error })
    } else {
      toast.add({
        type: "success",
        title: "Clip uploaded",
        description: "We’re converting it and finding key moments.",
      })
    }
    router.refresh()
  }

  return (
    // Button and progress are separate items so the parent's layout can put
    // the progress bar on its own full-width row.
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label="Video file"
        data-testid="footage-file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void start(file)
        }}
      />
      <Button
        type="button"
        disabled={disabled || upload !== null}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon data-icon="inline-start" />
        Upload video
      </Button>
      {upload && (
        <div className="flex basis-full items-end gap-2">
          <Progress
            value={Math.round(upload.progress * 100)}
            className="flex-1"
          >
            <ProgressLabel className="truncate">
              Uploading {upload.name}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel upload"
            onClick={() => upload.controller.abort()}
          >
            <XIcon />
          </Button>
        </div>
      )}
    </>
  )
}
