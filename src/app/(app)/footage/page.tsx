import { ArrowRightIcon, FilmIcon, PaletteIcon } from "lucide-react"
import type { Metadata } from "next"

import { listBrandKits } from "@/features/brand-kits"
import {
  AddFootage,
  FootageGrid,
  footageLimitsFor,
  listFootage,
  RefreshWhileProcessing,
  withPosterUrls,
} from "@/features/footage"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import { plans } from "@/shared/config/plans"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import { LinkButton } from "@/shared/ui/link-button"

export const metadata: Metadata = { title: "Footage" }

/**
 * Every clip in the workspace, one click from the sidebar, and recording
 * or uploading without first opening a brand kit.
 */
export default async function AllFootagePage() {
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const [kits, clips] = await Promise.all([
    listBrandKits(workspace.id),
    listFootage(workspace.id).then(withPosterUrls),
  ])

  const limits = footageLimitsFor(workspace.plan)
  const canAdd = can(role, "content:create")
  const isWorking = clips.some(
    (clip) => clip.status === "UPLOADING" || clip.status === "PROCESSING"
  )
  const kitChoices = kits.map((kit) => ({
    id: kit.id,
    name: kit.name,
    full: kit._count.footage >= limits.clipsPerBrandKit,
  }))
  const allFull = kitChoices.every((kit) => kit.full)

  return (
    <div className="flex flex-1 flex-col gap-8">
      <RefreshWhileProcessing active={isWorking} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Footage
        </h1>
        <p className="text-muted-foreground">
          Your screen recordings. Open one to edit it.
        </p>
      </div>

      {kits.length === 0 ? (
        <Empty className="flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PaletteIcon />
            </EmptyMedia>
            <EmptyTitle>Start with your brand kit</EmptyTitle>
            <EmptyDescription>
              Footage belongs to a brand kit, which gives your videos their
              colours, fonts and logo. Paste your app’s website to make one.
            </EmptyDescription>
          </EmptyHeader>
          {canAdd && (
            <EmptyContent>
              <LinkButton
                href="/brand-kits"
                icon={<ArrowRightIcon />}
                iconPosition="end"
              >
                Create a brand kit
              </LinkButton>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          {canAdd &&
            (allFull ? (
              <Alert>
                <AlertTitle>You’ve used every clip on your plan</AlertTitle>
                <AlertDescription>
                  Each brand kit holds up to {limits.clipsPerBrandKit} clips on
                  the {plans[workspace.plan].name} plan. Delete one to add
                  another.
                </AlertDescription>
              </Alert>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Add footage</CardTitle>
                  <CardDescription>
                    Record your app or upload a screen recording. We find the
                    key moments, then it’s ready to edit.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddFootage
                    kits={kitChoices}
                    maxBytes={limits.maxBytes}
                    maxDurationSeconds={limits.maxDurationSeconds}
                  />
                </CardContent>
              </Card>
            ))}

          {clips.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FilmIcon />
                </EmptyMedia>
                <EmptyTitle>No footage yet</EmptyTitle>
                <EmptyDescription>
                  {canAdd
                    ? "Record a short walk through your app, or upload a screen recording you already have."
                    : "An owner or editor can add footage."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <FootageGrid
              clips={clips}
              from="footage"
              showKit={kits.length > 1}
            />
          )}
        </>
      )}
    </div>
  )
}
