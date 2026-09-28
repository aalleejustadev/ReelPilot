"use client"

import { CheckIcon, PencilIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { projectLimits } from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { renameProject } from "../actions"

/** The project's name as the page heading, renamed in place. */
export function RenameProject({
  projectId,
  name,
  readOnly,
}: {
  projectId: string
  name: string
  readOnly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [shown, setShown] = useState(name)
  const [draft, setDraft] = useState(name)
  const [isSaving, startSave] = useTransition()

  function save() {
    const next = draft.trim()
    if (!next || next === shown) {
      setEditing(false)
      setDraft(shown)
      return
    }
    startSave(async () => {
      const result = await renameProject({ projectId, name: next })
      if (result.ok) {
        setShown(next)
        setEditing(false)
      } else {
        toast.add({ type: "error", title: result.error.message })
      }
    })
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <Input
          aria-label="Project name"
          autoFocus
          value={draft}
          maxLength={projectLimits.name}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(shown)
              setEditing(false)
            }
          }}
          className="h-7 max-w-64 text-sm"
        />
        <Button
          type="submit"
          size="icon-sm"
          variant="ghost"
          aria-label="Save name"
          disabled={isSaving}
        >
          {isSaving ? <Spinner /> : <CheckIcon />}
        </Button>
      </form>
    )
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <h1 className="truncate text-sm font-semibold">{shown}</h1>
      {!readOnly && (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Rename project"
          onClick={() => {
            setDraft(shown)
            setEditing(true)
          }}
        >
          <PencilIcon />
        </Button>
      )}
    </div>
  )
}
