import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { listFootage, withPosterUrls } from "@/features/footage"
import { getProject, ProjectEditor } from "@/features/projects"
import { can, requireWorkspaceAccess } from "@/features/workspaces"

export const metadata: Metadata = { title: "Project" }

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params
  const { workspace, role } = await requireWorkspaceAccess("workspace:view")
  const project = await getProject(workspace.id, projectId)
  if (!project) notFound()
  const kitClips = await withPosterUrls(
    await listFootage(workspace.id, project.kit.id)
  )

  return (
    <ProjectEditor
      // A saved clip list the page reloads with keeps its edits.
      project={project}
      kitClips={kitClips.map((clip) => ({
        id: clip.id,
        name: clip.name,
        status: clip.status,
        durationMs: clip.durationMs,
        posterUrl: clip.posterUrl,
      }))}
      readOnly={!can(role, "content:edit")}
    />
  )
}
