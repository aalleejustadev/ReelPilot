"use client"

import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { DropdownMenuItem } from "@/shared/ui/dropdown-menu"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { authClient } from "../lib/auth-client"

export function SignOutMenuItem() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function signOut() {
    setIsPending(true)
    const { error } = await authClient.signOut()
    if (error) {
      toast.add({
        type: "error",
        title: "We couldn’t sign you out. Try again.",
      })
      setIsPending(false)
      return
    }
    router.push("/sign-in")
    router.refresh()
  }

  return (
    // Stays open so the spinner is visible until sign-out finishes.
    <DropdownMenuItem
      closeOnClick={false}
      disabled={isPending}
      onClick={signOut}
    >
      {isPending ? <Spinner /> : <LogOutIcon />}
      Sign out
    </DropdownMenuItem>
  )
}
