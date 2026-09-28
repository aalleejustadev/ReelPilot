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

import { deleteFootage } from "../actions"

export function DeleteClipButton({
  footageId,
  clipName,
  afterDeleteHref,
}: {
  footageId: string
  clipName: string
  /** Where to go once it's gone (the list the editor was opened from). */
  afterDeleteHref: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  function confirmDelete() {
    startDelete(async () => {
      const result = await deleteFootage(footageId)
      if (result.ok) {
        toast.add({ type: "success", title: "Clip deleted" })
        setOpen(false)
        router.push(afterDeleteHref)
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
          <Button type="button" variant="outline" aria-label="Delete clip" />
        }
      >
        <TrashIcon data-icon="inline-start" />
        {/* Icon only on narrow screens, where the editor's top bar is full. */}
        <span className="hidden sm:inline">Delete clip</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {clipName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the clip and its key moments. It can’t be undone.
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
            Delete clip
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
