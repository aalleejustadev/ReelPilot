"use client"

import { useActionState, useEffect, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Field, FieldError, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { updateProfile } from "../actions"
import { profileNameMaxLength } from "../schema"

export function ProfileForm({ currentName }: { currentName: string }) {
  // Controlled: revalidation re-renders with the new name (build plan §12.5).
  const [name, setName] = useState(currentName)
  const [result, formAction, isPending] = useActionState(updateProfile, null)

  useEffect(() => {
    if (!result) return
    if (result.ok) toast.add({ type: "success", title: "Name saved" })
    else if (result.error.code !== "VALIDATION") {
      toast.add({ type: "error", title: result.error.message })
    }
  }, [result])

  const nameError =
    result && !result.ok ? result.error.fieldErrors?.name?.[0] : undefined

  return (
    <form action={formAction}>
      <Field data-invalid={nameError ? true : undefined}>
        <FieldLabel htmlFor="profile-name">Name</FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="profile-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={profileNameMaxLength}
            autoComplete="name"
            aria-invalid={nameError ? true : undefined}
            required
          />
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </div>
        {nameError && <FieldError>{nameError}</FieldError>}
      </Field>
    </form>
  )
}
