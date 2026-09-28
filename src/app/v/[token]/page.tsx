import { ClapperboardIcon, ClockIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"

import { getSharedVideo } from "@/features/exports"
import { site } from "@/shared/config/site"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"

// A public share link (§7.15): anyone can watch, no account. Not in the
// proxy's matcher, so signed-out visitors aren't redirected.

const sharedVideo = cache(getSharedVideo)

const aspectOf = { "16:9": "16 / 9", "9:16": "9 / 16", "1:1": "1 / 1" }

export async function generateMetadata({
  params,
}: PageProps<"/v/[token]">): Promise<Metadata> {
  const shared = await sharedVideo((await params).token)
  return {
    title: shared?.name ?? "Video not found",
    // Private links: never in search results.
    robots: { index: false, follow: false },
    openGraph: shared?.posterUrl
      ? { title: shared.name, images: [shared.posterUrl] }
      : undefined,
  }
}

export default async function SharedVideoPage({
  params,
}: PageProps<"/v/[token]">) {
  const shared = await sharedVideo((await params).token)
  if (!shared) notFound()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 sm:px-6"
      >
        <h1 className="w-full truncate text-center text-xl font-semibold tracking-tight sm:text-2xl">
          {shared.name}
        </h1>
        {shared.video ? (
          <video
            // No poster: the clip's is its recording, not the export's
            // shape; the browser shows the export's first frame instead.
            src={shared.video.url}
            controls
            playsInline
            preload="auto"
            aria-label={shared.name}
            className="max-h-[75dvh] max-w-full rounded-lg bg-black shadow-sm"
            style={{ aspectRatio: aspectOf[shared.video.shape] }}
          />
        ) : (
          <Empty className="w-full border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClockIcon />
              </EmptyMedia>
              <EmptyTitle>This video isn’t ready yet</EmptyTitle>
              <EmptyDescription>
                It shows here once it has been exported. Check back soon.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
      <footer className="flex justify-center pb-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ClapperboardIcon aria-hidden className="size-4" />
          Made with {site.name}
        </Link>
      </footer>
    </div>
  )
}
