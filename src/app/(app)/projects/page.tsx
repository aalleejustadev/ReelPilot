import { ClapperboardIcon, PaletteIcon } from "lucide-react"
import type { Metadata } from "next"

import { listBrandKits } from "@/features/brand-kits"
import {
  listProjects,
  NewProjectButton,
  ProjectsGrid,
} from "@/features/projects"
import { can, requireWorkspaceAccess } from "@/features/workspaces"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import { LinkButton } from "@/shared/ui/link-button"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const [projects, kits] = await Promise.all([
    listProjects(workspace.id),
    listBrandKits(workspace.id),
  ])
  const canCreate = can(role, "content:create")

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Projects
          </h1>
          <p className="text-muted-foreground">
            Videos made from your clips, each played with its own edit.
          </p>
        </div>
        {/* With no projects the empty state offers it instead. */}
        {canCreate && kits.length > 0 && projects.length > 0 && (
          <NewProjectButton kits={kits} />
        )}
      </div>

      {projects.length > 0 ? (
        <ProjectsGrid projects={projects} />
      ) : (
        <Empty className="flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {kits.length > 0 ? <ClapperboardIcon /> : <PaletteIcon />}
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              {kits.length === 0
                ? "Projects use a brand kit’s footage, fonts and colours. Create a brand kit first."
                : canCreate
                  ? "Start a project, then add clips from a brand kit’s footage."
                  : "An owner or editor can start a project."}
            </EmptyDescription>
          </EmptyHeader>
          {canCreate && (
            <EmptyContent>
              {kits.length > 0 ? (
                <NewProjectButton kits={kits} />
              ) : (
                <LinkButton href="/brand-kits">Create a brand kit</LinkButton>
              )}
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
