import { ClapperboardIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getSession } from "@/features/auth"
import { site } from "@/shared/config/site"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (await getSession()) redirect("/dashboard")

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 self-center text-lg font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClapperboardIcon className="size-4" aria-hidden />
          </span>
          {site.name}
        </Link>
        {children}
      </div>
    </div>
  )
}
