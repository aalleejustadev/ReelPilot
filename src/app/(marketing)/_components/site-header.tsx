import Link from "next/link"

import { getSession } from "@/features/auth"
import { site } from "@/shared/config/site"
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/ui/button"

// Navigation uses real links styled as buttons (buttonVariants): Base UI
// Button gives a rendered <a> role="button", which misleads screen readers.
export async function SiteHeader() {
  const session = await getSession()

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {site.name}
        </Link>
        <nav className="flex items-center gap-2">
          {session ? (
            <Link href="/dashboard" className={cn(buttonVariants())}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                Sign in
              </Link>
              <Link href="/sign-up" className={cn(buttonVariants())}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
