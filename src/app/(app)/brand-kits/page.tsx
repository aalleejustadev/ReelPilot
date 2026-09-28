import { FileTextIcon, ImageIcon, PaletteIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import {
  brandKitLimit,
  CreateKitForm,
  listBrandKits,
  logoUrlFor,
} from "@/features/brand-kits"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import { plans } from "@/shared/config/plans"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { LinkButton } from "@/shared/ui/link-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

export const metadata: Metadata = { title: "Brand kits" }

export default async function BrandKitsPage() {
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const kits = await listBrandKits(workspace.id)
  const logos = await Promise.all(kits.map((kit) => logoUrlFor(kit.logoKey)))

  const limit = brandKitLimit(workspace.plan)
  const planName = plans[workspace.plan].name
  const canCreate = can(role, "content:create")
  const hasRoom = kits.length < limit
  const usage = `${kits.length} of ${limit} brand ${limit === 1 ? "kit" : "kits"} on the ${planName} plan`

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Brand kits
        </h1>
        <p className="text-muted-foreground">
          Your product’s look and details. Open a kit to record, upload and edit
          its footage.
        </p>
      </div>

      {kits.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PaletteIcon />
            </EmptyMedia>
            <EmptyTitle>No brand kits yet</EmptyTitle>
            <EmptyDescription>
              {canCreate
                ? "Paste your app’s website and we’ll draft your first one."
                : "An owner or editor can add the first one."}
            </EmptyDescription>
          </EmptyHeader>
          {canCreate && (
            <EmptyContent className="w-full max-w-lg text-left">
              <CreateKitForm />
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit, index) => {
              const logo = logos[index]
              return (
                <li key={kit.id} className="flex">
                  <Card className="relative w-full transition-shadow hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
                    <CardHeader className="flex items-center gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-background p-1.5">
                        {logo ? (
                          // Signed, short-lived storage URL (see LogoField).
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logo}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <ImageIcon
                            aria-hidden
                            className="text-muted-foreground"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <CardTitle className="truncate">
                          {/* The link covers the whole card and opens the
                              kit's footage, where editing starts. */}
                          <Link
                            href={`/brand-kits/${kit.id}/footage`}
                            className="outline-none after:absolute after:inset-0"
                          >
                            {kit.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="truncate">
                          {new URL(kit.url).hostname.replace(/^www\./, "")}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    {kit.description && (
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {kit.description}
                        </p>
                      </CardContent>
                    )}
                    <CardFooter className="mt-auto justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {kit._count.footage}{" "}
                        {kit._count.footage === 1 ? "clip" : "clips"}
                      </span>
                      {/* Above the card's link. */}
                      <LinkButton
                        href={`/brand-kits/${kit.id}`}
                        variant="ghost"
                        size="sm"
                        icon={<FileTextIcon />}
                        className="relative"
                        aria-label={`${kit.name} details`}
                      >
                        Details
                      </LinkButton>
                    </CardFooter>
                  </Card>
                </li>
              )
            })}
          </ul>

          {canCreate &&
            (hasRoom ? (
              <Card>
                <CardHeader>
                  <CardTitle>Add a brand kit</CardTitle>
                  <CardDescription>{usage}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CreateKitForm />
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertTitle>
                  You’ve used every brand kit on your plan
                </AlertTitle>
                <AlertDescription>
                  {usage}. Delete one to add another.
                </AlertDescription>
              </Alert>
            ))}
        </>
      )}
    </div>
  )
}
