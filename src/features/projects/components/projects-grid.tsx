import { ClapperboardIcon } from "lucide-react"
import Link from "next/link"

import { formatDuration } from "@/features/footage"
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import type { ProjectListItem } from "../queries"
import { DeleteProjectButton } from "./delete-project-button"

const updated = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
})

/** Videos as cards; each opens its video (the clip editor for one clip). */
export function ProjectsGrid({
  projects,
  canDelete = false,
}: {
  projects: ProjectListItem[]
  canDelete?: boolean
}) {
  return (
    <ul
      aria-label="Videos"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {projects.map((project) => (
        <li key={project.id} className="flex">
          <Card className="relative w-full gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
            {canDelete && (
              // Above the card's link (it covers the whole card).
              <div className="absolute top-2 right-2 z-10">
                <DeleteProjectButton
                  projectId={project.id}
                  name={project.name}
                  compact
                  afterDelete="refresh"
                />
              </div>
            )}
            <div className="flex aspect-video items-center justify-center bg-muted">
              {project.posterUrl ? (
                // Signed, short-lived storage URL (see brand-kits LogoField).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.posterUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ClapperboardIcon
                  aria-hidden
                  className="text-muted-foreground"
                />
              )}
            </div>
            <CardHeader className="gap-2 pt-5">
              <CardTitle className="line-clamp-2 leading-snug break-words">
                {/* The link covers the whole card. */}
                <Link
                  href={`/videos/${project.id}`}
                  className="outline-none after:absolute after:inset-0"
                >
                  {project.name}
                </Link>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{project.kit.name}</span>
                <span aria-hidden>·</span>
                <span>
                  {project.clipCount === 0
                    ? "No clips yet"
                    : `${project.clipCount} ${project.clipCount === 1 ? "clip" : "clips"}`}
                </span>
                {project.clipCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-mono">
                      {formatDuration(project.durationMs)}
                    </span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span>Edited {updated.format(project.updatedAt)}</span>
              </CardDescription>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  )
}
