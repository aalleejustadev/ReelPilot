"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState, useTransition } from "react"

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

import { createBrandKitFromUrl, createBrandKitManually } from "../actions"

/** Paste a website → AI drafts the kit → open it in the editor. */
export function CreateKitForm() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [result, formAction, isPending] = useActionState(
    createBrandKitFromUrl,
    null
  )
  const [isCreatingManually, startManual] = useTransition()

  useEffect(() => {
    if (!result) return
    if (result.ok) {
      toast.add({ type: "success", title: "Brand kit created" })
      const query = result.data.isComplete ? "" : "?draft=partial"
      router.push(`/brand-kits/${result.data.kitId}${query}`)
    } else if (result.error.code !== "VALIDATION") {
      toast.add({ type: "error", title: result.error.message })
    }
  }, [result, router])

  const error = result && !result.ok ? result.error : null
  const urlError =
    error?.fieldErrors?.url?.[0] ??
    (error?.code === "VALIDATION" ? error.message : undefined)
  // Reading the site failed (or the daily AI limit was hit): offer a way on.
  // A plan limit or missing permission would fail the same way, so not then.
  const canFillManually =
    error !== null && error.code !== "PLAN_LIMIT" && error.code !== "FORBIDDEN"

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
    <form action={formAction} className="flex flex-col gap-3">
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
            required
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
              ? "Reading your site and drafting your brief. This takes about 15 seconds."
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
