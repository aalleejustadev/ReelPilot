import { ArrowRightIcon, ClapperboardIcon, PaletteIcon } from "lucide-react"
import type { Metadata } from "next"

import { listBrandKits } from "@/features/brand-kits"
import {
  listProjects,
  NewProjectButton,
  ProjectsGrid,
} from "@/features/projects"
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

/** How many recent projects the dashboard shows. */
const recent = 6

export default async function DashboardPage() {
  const { user, workspace, role } = await getCurrentWorkspace()
  const firstName = user.name.trim().split(/\s+/)[0]
  const [kits, projects] = await Promise.all([
    listBrandKits(workspace.id),
    listProjects(workspace.id, { take: recent + 1 }),
  ])
  const canCreate = can(role, "content:create")

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </h1>
          <p className="text-muted-foreground">
            {projects.length > 0
              ? "Pick up where you left off."
              : "Turn your screen recordings into polished videos."}
          </p>
        </div>
        {/* With no projects the empty state offers it instead. */}
        {canCreate && kits.length > 0 && projects.length > 0 && (
          <NewProjectButton kits={kits} />
        )}
      </div>

      {projects.length > 0 ? (
        <section
          aria-labelledby="recent-heading"
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-heading" className="text-lg font-semibold">
              Recent projects
            </h2>
            {projects.length > recent && (
              <LinkButton
                href="/projects"
                variant="ghost"
                icon={<ArrowRightIcon />}
                iconPosition="end"
              >
                All projects
              </LinkButton>
            )}
          </div>
          <ProjectsGrid projects={projects.slice(0, recent)} />
        </section>
      ) : (
        <Empty className="flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {kits.length > 0 ? <ClapperboardIcon /> : <PaletteIcon />}
            </EmptyMedia>
            <EmptyTitle>
              {kits.length > 0
                ? "Make your first video"
                : "Start with your brand kit"}
            </EmptyTitle>
            <EmptyDescription>
              {kits.length > 0
                ? "Start a project, add your clips and join them into one video."
                : "Paste your app’s website: we’ll pick up its colours, fonts and logo for your videos."}
            </EmptyDescription>
          </EmptyHeader>
          {canCreate && (
            <EmptyContent>
              {kits.length > 0 ? (
                <NewProjectButton kits={kits} />
              ) : (
                <LinkButton
                  href="/brand-kits"
                  icon={<ArrowRightIcon />}
                  iconPosition="end"
                >
                  Create a brand kit
                </LinkButton>
              )}
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
