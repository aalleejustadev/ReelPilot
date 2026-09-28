"use client"

import { RotateCwIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog"

/**
 * A save was refused because the thing changed elsewhere (another tab,
 * window or person) since this page loaded. Reloading gets the latest;
 * staying keeps this page open but stops saving from it.
 */
export function ConflictDialog({
  open,
  what,
  onOpenChange,
}: {
  open: boolean
  /** "clip", "project"… */
  what: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            This {what} changed somewhere else
          </AlertDialogTitle>
          <AlertDialogDescription>
            It was saved from another tab or window after this page opened, so
            the change you just made here wasn’t saved (it would have replaced
            that work). Reload to carry on from the latest version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay on this page</AlertDialogCancel>
          <AlertDialogAction onClick={() => window.location.reload()}>
            <RotateCwIcon data-icon="inline-start" />
            Reload
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
