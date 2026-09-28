"use client"

import { TrashIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog"
import { Button } from "@/shared/ui/button"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { deleteProject } from "../actions"

export function DeleteProjectButton({
  projectId,
  name,
  compact = false,
  afterDelete = "list",
}: {
  projectId: string
  name: string
  /** An icon-only button (on a card). */
  compact?: boolean
  /** Go to the videos list, or (already there) refresh it. */
  afterDelete?: "list" | "refresh"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  function confirmDelete() {
    startDelete(async () => {
      const result = await deleteProject({ projectId })
      if (result.ok) {
        toast.add({ type: "success", title: "Video deleted" })
        setOpen(false)
        if (afterDelete === "list") router.push("/videos")
        else router.refresh()
      } else {
        toast.add({ type: "error", title: result.error.message })
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !isDeleting && setOpen(next)}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant={compact ? "secondary" : "outline"}
            size={compact ? "icon-sm" : "default"}
            aria-label={compact ? `Delete ${name}` : "Delete video"}
          />
        }
      >
        <TrashIcon data-icon={compact ? undefined : "inline-start"} />
        {!compact && <span className="hidden sm:inline">Delete video</span>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the video. Its clips and their edits stay in the brand
            kit’s footage. It can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete video
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
