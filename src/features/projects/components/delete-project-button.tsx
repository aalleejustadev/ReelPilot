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
}: {
  projectId: string
  name: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  function confirmDelete() {
    startDelete(async () => {
      const result = await deleteProject({ projectId })
      if (result.ok) {
        toast.add({ type: "success", title: "Project deleted" })
        setOpen(false)
        router.push("/projects")
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
          <Button type="button" variant="outline" aria-label="Delete project" />
        }
      >
        <TrashIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Delete project</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the project. Its clips and their edits stay in the
            brand kit’s footage. It can’t be undone.
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
            Delete project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
