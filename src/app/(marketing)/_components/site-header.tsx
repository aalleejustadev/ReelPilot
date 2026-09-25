import Link from "next/link"

import { getSession } from "@/features/auth"
import { site } from "@/shared/config/site"
import { LinkButton } from "@/shared/ui/link-button"

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
            <LinkButton href="/dashboard">Dashboard</LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="ghost">
                Sign in
              </LinkButton>
              <LinkButton href="/sign-up">Sign up</LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
