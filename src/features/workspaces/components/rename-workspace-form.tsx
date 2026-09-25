"use client"

import { useActionState, useEffect } from "react"

import { Button } from "@/shared/ui/button"
import { Field, FieldError, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { renameWorkspace } from "../actions"
import { workspaceNameMaxLength } from "../schema"

export function RenameWorkspaceForm({ currentName }: { currentName: string }) {
  // useActionState's isPending is true for the whole action, so the button
  // shows its loading state immediately (build plan §12.5).
  const [result, formAction, isPending] = useActionState(renameWorkspace, null)

  useEffect(() => {
    if (!result) return
    if (result.ok) toast.add({ type: "success", title: "Workspace renamed" })
    else if (result.error.code !== "VALIDATION") {
      toast.add({ type: "error", title: result.error.message })
    }
  }, [result])

  const nameError =
    result && !result.ok ? result.error.fieldErrors?.name?.[0] : undefined

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field data-invalid={nameError ? true : undefined}>
        <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="workspace-name"
            name="name"
            defaultValue={currentName}
            maxLength={workspaceNameMaxLength}
            aria-invalid={nameError ? true : undefined}
            required
          />
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Rename
          </Button>
        </div>
        {nameError && <FieldError>{nameError}</FieldError>}
      </Field>
    </form>
  )
}
