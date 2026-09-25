import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import { site } from "@/shared/config/site"
import { Badge } from "@/shared/ui/badge"
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/ui/button"

// Temporary hero. The real landing page ships in M12.
export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
      <Badge variant="outline">Video ads for SaaS founders</Badge>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        {site.tagline}
      </h1>
      <p className="max-w-xl text-lg text-balance text-muted-foreground">
        Paste your URL and get scroll-stopping video ads built from your real
        product footage, with a presenter who sells it.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }))}>
          Get started free
          <ArrowRightIcon data-icon="inline-end" />
        </Link>
        <Link
          href="/sign-in"
          className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
        >
          Sign in
        </Link>
      </div>
    </section>
  )
}
