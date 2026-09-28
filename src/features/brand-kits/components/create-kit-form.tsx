"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { Result } from "@/shared/lib/result"
import { Button } from "@/shared/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import {
  createBrandKitFromUrl,
  createBrandKitManually,
  type CreatedKit,
} from "../actions"

/**
 * Paste a website → AI drafts the kit → open it in the editor.
 *
 * Navigation happens in the submit handler, not an effect on the action's
 * result: creating the first kit re-renders the page (the empty state goes),
 * so an effect would never run.
 */
export function CreateKitForm() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [failure, setFailure] = useState<Result<CreatedKit> | null>(null)
  const [isPending, startCreate] = useTransition()
  const [isCreatingManually, startManual] = useTransition()

  function create(event: React.FormEvent) {
    event.preventDefault()
    startCreate(async () => {
      const result = await createBrandKitFromUrl(url)
      if (result.ok) {
        toast.add({ type: "success", title: "Brand kit created" })
        const query = result.data.isComplete ? "" : "?draft=partial"
        router.push(`/brand-kits/${result.data.kitId}${query}`)
        return
      }
      setFailure(result)
      if (result.error.code !== "VALIDATION") {
        toast.add({ type: "error", title: result.error.message })
      }
    })
  }

  const error = failure && !failure.ok ? failure.error : null
  const urlError =
    error?.fieldErrors?.url?.[0] ??
    (error?.code === "VALIDATION" ? error.message : undefined)
  // Reading the site failed (or the daily AI limit was hit): offer a way on.
  // A missing permission would fail the same way, so not then.
  const canFillManually = error !== null && error.code !== "FORBIDDEN"

  function createManually() {
    startManual(async () => {
      const manual = await createBrandKitManually(url)
      if (manual.ok) {
        toast.add({ type: "success", title: "Brand kit created" })
        router.push(`/brand-kits/${manual.data.kitId}`)
      } else {
        toast.add({ type: "error", title: manual.error.message })
      }
    })
  }

  const isBusy = isPending || isCreatingManually

  return (
    <form onSubmit={create} className="flex flex-col gap-3" noValidate>
      <Field data-invalid={urlError ? true : undefined}>
        <FieldLabel htmlFor="brand-kit-url">Your app’s website</FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="brand-kit-url"
            name="url"
            // Plain text, not type="url": "yourapp.com" should be accepted.
            inputMode="url"
            autoComplete="url"
            placeholder="yourapp.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-invalid={urlError ? true : undefined}
            disabled={isBusy}
          />
          <Button type="submit" disabled={isBusy}>
            {isPending && <Spinner data-icon="inline-start" />}
            Create from website
          </Button>
        </div>
        {urlError ? (
          <FieldError>{urlError}</FieldError>
        ) : (
          <FieldDescription aria-live="polite">
            {isPending
              ? "Reading your site and drafting your brief. This can take up to 30 seconds."
              : "We’ll read your site and draft the brief. You can edit everything after."}
          </FieldDescription>
        )}
      </Field>
      {canFillManually && (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={createManually}
            disabled={isBusy}
          >
            {isCreatingManually && <Spinner data-icon="inline-start" />}
            Fill it in myself
          </Button>
        </div>
      )}
    </form>
  )
}
