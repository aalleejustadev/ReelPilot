import { ClapperboardIcon } from "lucide-react"
import Link from "next/link"

import { formatDuration } from "@/features/footage"
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import type { ProjectListItem } from "../queries"

const updated = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
})

/** Projects as cards; each opens its project page. */
export function ProjectsGrid({ projects }: { projects: ProjectListItem[] }) {
  return (
    <ul
      aria-label="Projects"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {projects.map((project) => (
        <li key={project.id} className="flex">
          <Card className="relative w-full gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
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
                  href={`/projects/${project.id}`}
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
