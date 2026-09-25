import { UsersIcon } from "lucide-react"
import type { Metadata } from "next"

import { listPresenters, PresenterGrid } from "@/features/presenters"
import { requireWorkspaceAccess } from "@/features/workspaces"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"

export const metadata: Metadata = { title: "Presenters" }

export default async function PresentersPage() {
  await requireWorkspaceAccess("workspace:view")
  const presenters = await listPresenters()

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Presenters
        </h1>
        <p className="text-muted-foreground">
          The faces and voices that present your ads. When you build a campaign,
          you can pair any presenter with any voice.
        </p>
      </div>
      {presenters.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No presenters yet</EmptyTitle>
            <EmptyDescription>
              The presenter library isn’t set up yet. Check back soon.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <PresenterGrid presenters={presenters} />
      )}
    </div>
  )
}
