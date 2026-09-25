"use client"

import { ImageIcon, TrashIcon, UploadIcon } from "lucide-react"
import { useRef, useTransition } from "react"

import { Button } from "@/shared/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { removeBrandKitLogo, uploadBrandKitLogo } from "../actions"

// Mirrors lib/logo.ts (server-only); the server re-checks size and type.
const maxBytes = 2 * 1024 * 1024
const accept = "image/png,image/jpeg,image/webp"

/** Uploads or removes the logo right away (not part of Save). */
export function LogoField({
  kitId,
  kitName,
  logoUrl,
  readOnly,
}: {
  kitId: string
  kitName: string
  logoUrl: string | null
  readOnly: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [isRemoving, startRemove] = useTransition()

  function upload(file: File) {
    if (file.size > maxBytes) {
      toast.add({
        type: "error",
        title:
          "Your logo is larger than 2 MB. Export a smaller PNG, JPEG or WebP.",
      })
      return
    }
    startUpload(async () => {
      const formData = new FormData()
      formData.set("kitId", kitId)
      formData.set("logo", file)
      const result = await uploadBrandKitLogo(formData)
      toast.add(
        result.ok
          ? { type: "success", title: "Logo uploaded" }
          : { type: "error", title: result.error.message }
      )
    })
  }

  function remove() {
    startRemove(async () => {
      const result = await removeBrandKitLogo(kitId)
      toast.add(
        result.ok
          ? { type: "success", title: "Logo removed" }
          : { type: "error", title: result.error.message }
      )
    })
  }

  const isBusy = isUploading || isRemoving

  return (
    <Field>
      <FieldLabel htmlFor="brand-kit-logo">Logo</FieldLabel>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border bg-background p-2">
          {logoUrl ? (
            // A short-lived signed URL from private storage: next/image would
            // proxy and cache it past its expiry.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${kitName} logo`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon aria-hidden className="text-muted-foreground" />
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id="brand-kit-logo"
              type="file"
              accept={accept}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) upload(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                disabled={isBusy}
                onClick={remove}
              >
                {isRemoving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <TrashIcon data-icon="inline-start" />
                )}
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      <FieldDescription>PNG, JPEG or WebP, up to 2 MB.</FieldDescription>
    </Field>
  )
}
