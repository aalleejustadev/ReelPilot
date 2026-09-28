import "server-only"

import { getBrandKit, logoUrlFor } from "@/features/brand-kits"
import { parseStoredShot, presentationFor } from "@/features/footage"
import { db } from "@/shared/db"
import {
  outputDuration,
  projectLayout,
  transitionSchema,
  defaultClipTransition,
  type Presentation,
  type TimedShot,
  type Transition,
} from "@/shared/motion"
import { signedFileUrl } from "@/shared/storage"

const hour = 60 * 60

const clipFields = {
  id: true,
  name: true,
  status: true,
  durationMs: true,
  width: true,
  height: true,
  presentation: true,
  posterKey: true,
  videoKey: true,
  markers: {
    orderBy: { atMs: "asc" as const },
    select: { atMs: true, shot: true },
  },
}

const storedTransition = (value: unknown): Transition =>
  transitionSchema.safeParse(value).data ?? defaultClipTransition

/** A clip's edited length (its ad time after cuts and speed changes). */
function editedLength(presentation: Presentation, durationMs: number) {
  return Math.round(outputDuration(presentation.edit, durationMs))
}

/** A project's name, for a link back to it (null if not in the workspace). */
export async function getProjectName(workspaceId: string, projectId: string) {
  return db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true },
  })
}

/** The workspace's projects, most recently changed first. */
export async function listProjects(
  workspaceId: string,
  options: { take?: number } = {}
) {
  const projects = await db.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: options.take,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      brandKit: { select: { id: true, name: true, colors: true } },
      clips: {
        orderBy: { position: "asc" },
        select: {
          transition: true,
          footage: {
            select: { durationMs: true, presentation: true, posterKey: true },
          },
        },
      },
    },
  })
  return Promise.all(
    projects.map(async (project) => {
      const colors = (project.brandKit.colors ?? {}) as {
        primary?: string
        secondary?: string
      }
      const { durationMs } = projectLayout(
        project.clips.map((clip) => ({
          lengthMs: editedLength(
            presentationFor(clip.footage.presentation, colors),
            clip.footage.durationMs ?? 0
          ),
          transition: storedTransition(clip.transition),
        }))
      )
      const poster = project.clips[0]?.footage.posterKey
      return {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        kit: { id: project.brandKit.id, name: project.brandKit.name },
        clipCount: project.clips.length,
        durationMs,
        posterUrl: poster ? await signedFileUrl(poster, hour) : null,
      }
    })
  )
}
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number]

/** What the project page plays and edits, or null if not in the workspace. */
export async function getProject(workspaceId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      name: true,
      version: true,
      brandKitId: true,
      clips: {
        orderBy: { position: "asc" },
        select: { id: true, transition: true, footage: { select: clipFields } },
      },
    },
  })
  if (!project) return null
  const kit = await getBrandKit(workspaceId, project.brandKitId)
  if (!kit) return null

  const clips = await Promise.all(
    project.clips.map(async (entry) => {
      const clip = entry.footage
      const presentation = presentationFor(clip.presentation, kit.colors)
      const shots: TimedShot[] = clip.markers.flatMap((marker) => {
        const shot = parseStoredShot(marker.shot)
        return shot ? [{ atMs: marker.atMs, shot }] : []
      })
      const [videoUrl, posterUrl] = await Promise.all([
        clip.videoKey ? signedFileUrl(clip.videoKey, hour) : null,
        clip.posterKey ? signedFileUrl(clip.posterKey, hour) : null,
      ])
      return {
        footageId: clip.id,
        name: clip.name,
        transition: storedTransition(entry.transition),
        durationMs: clip.durationMs ?? 1,
        lengthMs: editedLength(presentation, clip.durationMs ?? 1),
        videoWidth: clip.width ?? 1920,
        videoHeight: clip.height ?? 1080,
        presentation,
        shots,
        videoUrl,
        posterUrl,
      }
    })
  )

  return {
    id: project.id,
    name: project.name,
    version: project.version,
    clips,
    kit: {
      id: kit.id,
      name: kit.name,
      url: kit.url,
      colors: kit.colors,
      fonts: kit.fonts,
      logoUrl: await logoUrlFor(kit.logoKey),
    },
  }
}
export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>
export type ProjectClipView = ProjectDetail["clips"][number]
