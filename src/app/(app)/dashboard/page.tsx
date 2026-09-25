import { ArrowRightIcon, PaletteIcon, SparklesIcon } from "lucide-react"
import type { Metadata } from "next"

import { listBrandKits } from "@/features/brand-kits"
import { can, getCurrentWorkspace } from "@/features/workspaces"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import { LinkButton } from "@/shared/ui/link-button"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const { user, workspace, role } = await getCurrentWorkspace()
  const firstName = user.name.trim().split(/\s+/)[0]
  const kits = await listBrandKits(workspace.id)
  const hasKit = kits.length > 0

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-muted-foreground">
          Here’s where your campaigns and ads will live.
        </p>
      </div>
      <Empty className="flex-1 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {hasKit ? <SparklesIcon /> : <PaletteIcon />}
          </EmptyMedia>
          <EmptyTitle>
            {hasKit ? "Your brand kit is ready" : "Start with your brand kit"}
          </EmptyTitle>
          <EmptyDescription>
            {hasKit
              ? "Campaigns are next: soon you’ll turn it into a batch of ads."
              : "Paste your app’s website and we’ll draft what ReelPilot needs to write ads for it."}
          </EmptyDescription>
        </EmptyHeader>
        {(hasKit || can(role, "content:create")) && (
          <EmptyContent>
            <LinkButton
              href="/brand-kits"
              variant={hasKit ? "outline" : "default"}
              icon={<ArrowRightIcon />}
              iconPosition="end"
            >
              {hasKit ? "View brand kits" : "Create a brand kit"}
            </LinkButton>
          </EmptyContent>
        )}
      </Empty>
    </div>
  )
}
