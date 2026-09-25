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

import { deleteBrandKit } from "../actions"

export function DeleteKitButton({
  kitId,
  kitName,
}: {
  kitId: string
  kitName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  function confirmDelete() {
    startDelete(async () => {
      const result = await deleteBrandKit(kitId)
      if (result.ok) {
        toast.add({ type: "success", title: "Brand kit deleted" })
        setOpen(false)
        router.push("/brand-kits")
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
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {kitName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the brand kit, its claims and its logo. It can’t be
            undone.
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
            Delete brand kit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
