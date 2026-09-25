import { SparklesIcon } from "lucide-react"
import type { Metadata } from "next"

import { getCurrentWorkspace } from "@/features/workspaces"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const { user } = await getCurrentWorkspace()
  const firstName = user.name.trim().split(/\s+/)[0]

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-muted-foreground">
          Here’s where your campaigns and ads will live.
        </p>
      </div>
      {/* No action yet: "Create brand kit" arrives with M1. */}
      <Empty className="flex-1 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>
          <EmptyTitle>Your workspace is ready</EmptyTitle>
          <EmptyDescription>
            Next, you’ll add your app’s brand kit so ReelPilot can write ads for
            it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
