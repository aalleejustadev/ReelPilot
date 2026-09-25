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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 sm:p-6">
      <Link href="/" className="text-base font-semibold tracking-tight">
        {site.name}
      </Link>
      {children}
    </div>
  )
}
