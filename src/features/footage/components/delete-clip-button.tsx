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
  kitId,
}: {
  footageId: string
  clipName: string
  kitId: string
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
        router.push(`/brand-kits/${kitId}/footage`)
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
      <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
        <TrashIcon data-icon="inline-start" />
        Delete clip
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
