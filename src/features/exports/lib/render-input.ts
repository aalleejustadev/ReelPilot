import "server-only"

import { z } from "zod"

import type { ProjectStageClip } from "@/remotion/compositions/ProjectStage"
import { renderFontFamily, stageFontsWith } from "@/remotion/fonts"
import type { RenderProps } from "@/remotion/Root"
import { db } from "@/shared/db"
import {
  defaultClipTransition,
  parseStoredShot,
  presentationFor,
  transitionSchema,
  type TimedShot,
} from "@/shared/motion"
import { signedFileUrl } from "@/shared/storage"

import type { ExportTarget } from "../schema"

// Only db, shared code and the compositions: the worker loads this, and a
// feature's index would pull in its UI (and next/font).

const kitColorsSchema = z
  .object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  })
  .partial()
const kitFontsSchema = z
  .object({ heading: z.string(), body: z.string() })
  .partial()
const paletteSchema = z.object({
  palette: z.object({ accents: z.array(z.string()) }),
})

const footageFields = {
  id: true,
  status: true,
  durationMs: true,
  width: true,
  height: true,
  presentation: true,
  videoKey: true,
  posterKey: true,
  analysis: true,
  markers: {
    orderBy: { atMs: "asc" as const },
    select: { atMs: true, shot: true },
  },
}
type FootageRow = {
  id: string
  status: string
  durationMs: number | null
  width: number | null
  height: number | null
  presentation: unknown
  videoKey: string | null
  posterKey: string | null
  analysis: unknown
  markers: { atMs: number; shot: unknown }[]
}

const kitFields = {
  id: true,
  name: true,
  url: true,
  colors: true,
  fonts: true,
  logoKey: true,
}

/** "https://www.acme.app/pricing" → "acme.app" (for end cards). */
function siteLabelFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export type RenderInput = {
  name: string
  kitId: string
  /** Why it can't be exported yet, or null. */
  notReady: string | null
  /** What the composition renders, minus the shape. */
  stage: Omit<RenderProps, "shape">
}

/**
 * Everything a render of `target` needs, exactly as the editor plays it
 * (same presentation defaults, shots, fonts, accents, logo and end card
 * text), with links signed for `linkSeconds`. Null if not in the workspace.
 */
export async function loadRenderInput(
  workspaceId: string,
  target: ExportTarget,
  { linkSeconds }: { linkSeconds: number }
): Promise<RenderInput | null> {
  const loaded =
    target.kind === "clip"
      ? await db.footage
          .findFirst({
            where: { id: target.id, workspaceId },
            select: {
              ...footageFields,
              name: true,
              brandKit: { select: kitFields },
            },
          })
          .then(
            (clip) =>
              clip && {
                name: clip.name,
                kit: clip.brandKit,
                clips: [{ footage: clip, transition: null as unknown }],
              }
          )
      : await db.project
          .findFirst({
            where: { id: target.id, workspaceId },
            select: {
              name: true,
              brandKit: { select: kitFields },
              clips: {
                orderBy: { position: "asc" },
                select: {
                  transition: true,
                  footage: { select: footageFields },
                },
              },
            },
          })
          .then(
            (project) =>
              project && {
                name: project.name,
                kit: project.brandKit,
                clips: project.clips,
              }
          )
  if (!loaded) return null

  const { kit } = loaded
  const colors = kitColorsSchema.safeParse(kit.colors).data ?? {}
  const brandColors = [colors.primary, colors.secondary, colors.accent].filter(
    (color): color is string => Boolean(color)
  )
  const sign = (key: string | null) =>
    key ? signedFileUrl(key, linkSeconds) : Promise.resolve(null)

  const clips: ProjectStageClip[] = await Promise.all(
    loaded.clips.map(async ({ footage, transition }) => {
      const clip = footage as FootageRow
      const shots: TimedShot[] = clip.markers.flatMap((marker) => {
        const shot = parseStoredShot(marker.shot)
        return shot ? [{ atMs: marker.atMs, shot }] : []
      })
      const [videoUrl, posterUrl] = await Promise.all([
        clip.status === "READY" ? sign(clip.videoKey) : null,
        sign(clip.posterKey),
      ])
      return {
        id: clip.id,
        videoUrl: videoUrl ?? "",
        posterUrl,
        videoWidth: clip.width ?? 1920,
        videoHeight: clip.height ?? 1080,
        presentation: presentationFor(clip.presentation, colors),
        shots,
        durationMs: clip.durationMs ?? 1,
        transition:
          transitionSchema.safeParse(transition).data ?? defaultClipTransition,
      }
    })
  )

  const statuses = loaded.clips.map(({ footage }) => footage.status)
  const notReady =
    clips.length === 0
      ? "Add a clip to the video first."
      : statuses.some((status) => status === "FAILED")
        ? target.kind === "clip"
          ? "This clip couldn’t be processed, so it can’t be exported."
          : "A clip couldn’t be processed. Remove it from the video, then export."
        : statuses.some((status) => status !== "READY") ||
            clips.some((clip) => !clip.videoUrl)
          ? "Wait until every clip has finished processing."
          : null

  // A clip plays with the colours it was recorded in as extra accents, as
  // in the clip editor; a video uses the kit's.
  const first = loaded.clips[0]?.footage as FootageRow | undefined
  const recorded =
    target.kind === "clip"
      ? (paletteSchema.safeParse(first?.analysis).data?.palette.accents ?? [])
      : []

  return {
    name: loaded.name,
    kitId: kit.id,
    notReady,
    stage: {
      clips,
      fonts: stageFontsWith(
        kitFontsSchema.safeParse(kit.fonts).data ?? {},
        renderFontFamily
      ),
      accents: [...brandColors, ...recorded],
      logoUrl: await sign(kit.logoKey),
      brandName: kit.name,
      siteLabel: siteLabelFor(kit.url),
    },
  }
}
