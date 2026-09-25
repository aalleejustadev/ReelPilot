"use client"

import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/shared/ui/button"
import { Spinner } from "@/shared/ui/spinner"
import { toast } from "@/shared/ui/toast"

import { authClient } from "../lib/auth-client"

export function SignOutButton() {
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
    <Button variant="outline" onClick={signOut} disabled={isPending}>
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <LogOutIcon data-icon="inline-start" />
      )}
      Sign out
    </Button>
  )
}
