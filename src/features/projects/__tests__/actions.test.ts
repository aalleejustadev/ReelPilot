import { randomUUID } from "node:crypto"

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { defaultPresentation } from "@/shared/motion"

// Replaced: the signed-in user and Next's cache. The rest is real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const hasDatabase = Boolean(process.env.DATABASE_URL)

const blur = { kind: "blur", durationMs: 500, direction: "left" } as const
const cut = { kind: "cut", durationMs: 0, direction: "left" } as const

describe.runIf(hasDatabase)("projects", () => {
  const userId = `test-${randomUUID()}`
  let db: typeof import("@/shared/db").db
  let actions: typeof import("../actions")
  let queries: typeof import("../queries")
  let workspaceId: string
  let kitId: string
  let otherKitId: string
  let clipA: string
  let clipB: string

  const clip = async (
    brandKitId: string,
    overrides: Record<string, unknown> = {}
  ) =>
    (
      await db.footage.create({
        data: {
          workspaceId,
          brandKitId,
          name: "Clip",
          source: "UPLOAD",
          status: "READY",
          originalKey: "k",
          contentType: "video/mp4",
          sizeBytes: 1,
          durationMs: 4000,
          width: 1280,
          height: 720,
          ...overrides,
        },
      })
    ).id

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    actions = await import("../actions")
    queries = await import("../queries")
    const user = await db.user.create({
      data: { id: userId, name: "Ada", email: `${userId}@example.com` },
    })
    requireUser.mockResolvedValue({ user })
    const { getCurrentWorkspace } = await import("@/features/workspaces")
    ;({
      workspace: { id: workspaceId },
    } = await getCurrentWorkspace())
    ;({ id: kitId } = await db.brandKit.create({
      data: { workspaceId, name: "Acme", url: "https://acme.app/" },
    }))
    ;({ id: otherKitId } = await db.brandKit.create({
      data: { workspaceId, name: "Other", url: "https://other.app/" },
    }))
    clipA = await clip(kitId, { name: "Intro" })
    clipB = await clip(kitId, {
      name: "Feature",
      durationMs: 6000,
      // Its edit plays 4s…6s at 2×: a 1s part after 4s kept.
      presentation: {
        ...defaultPresentation,
        edit: {
          parts: [
            { startMs: 0, speed: 1, removed: false, transition: cut },
            { startMs: 4000, speed: 2, removed: false, transition: cut },
          ],
        },
      },
    })
  })

  beforeEach(() => {
    requireUser.mockResolvedValue({ user: { id: userId, name: "Ada" } })
  })

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } })
    await db.workspace.deleteMany({ where: { id: workspaceId } })
  })

  async function newProject(name = "Launch video") {
    const result = await actions.createProject({ name, kitId })
    if (!result.ok) throw new Error(result.error.message)
    return result.data.projectId
  }

  it("creates, renames and deletes a project", async () => {
    const projectId = await newProject()
    expect(
      await actions.renameProject({ projectId, name: "  Launch  " })
    ).toEqual({
      ok: true,
      data: null,
    })
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).name
    ).toBe("Launch")
    expect(await actions.deleteProject({ projectId })).toEqual({
      ok: true,
      data: null,
    })
    expect(await db.project.count({ where: { id: projectId } })).toBe(0)
  })

  it("names an unnamed video, and needs one of the workspace's kits", async () => {
    const created = await actions.createProject({ name: " ", kitId })
    if (!created.ok) throw new Error(created.error.message)
    expect(
      (
        await db.project.findUniqueOrThrow({
          where: { id: created.data.projectId },
        })
      ).name
    ).toBe("Untitled video")
    expect(
      await actions.createProject({ name: "X", kitId: "not-a-kit" })
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } })
  })

  it("saves the clip list in order, bumping the version", async () => {
    const projectId = await newProject()
    expect(
      await actions.saveProjectClips({
        projectId,
        baseVersion: 0,
        clips: [
          { footageId: clipA, transition: cut },
          { footageId: clipB, transition: blur },
          // The same clip may play twice.
          { footageId: clipA, transition: cut },
        ],
      })
    ).toEqual({ ok: true, data: { version: 1 } })

    const project = await queries.getProject(workspaceId, projectId)
    expect(project?.version).toBe(1)
    expect(project?.clips.map((c) => [c.name, c.transition.kind])).toEqual([
      ["Intro", "cut"],
      ["Feature", "blur"],
      ["Intro", "cut"],
    ])
    // Each clip plays for its edited length: the Feature clip is 4s + 2s at 2×.
    expect(project?.clips.map((c) => c.lengthMs)).toEqual([4000, 5000, 4000])

    // Reordered and one removed, from version 1.
    expect(
      await actions.saveProjectClips({
        projectId,
        baseVersion: 1,
        clips: [
          { footageId: clipB, transition: cut },
          { footageId: clipA, transition: blur },
        ],
      })
    ).toEqual({ ok: true, data: { version: 2 } })
    expect(
      (await queries.getProject(workspaceId, projectId))?.clips.map(
        (c) => c.name
      )
    ).toEqual(["Feature", "Intro"])
  })

  it("refuses a save from a stale copy (changed in another tab)", async () => {
    const projectId = await newProject()
    await actions.saveProjectClips({
      projectId,
      baseVersion: 0,
      clips: [{ footageId: clipA, transition: cut }],
    })
    const stale = await actions.saveProjectClips({
      projectId,
      baseVersion: 0,
      clips: [],
    })
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFLICT" } })
    expect(await db.projectClip.count({ where: { projectId } })).toBe(1)
  })

  it("only takes this kit's clips (still processing is fine)", async () => {
    const projectId = await newProject()
    const elsewhere = await clip(otherKitId)
    const processing = await clip(kitId, { status: "PROCESSING" })
    expect(
      await actions.saveProjectClips({
        projectId,
        baseVersion: 0,
        clips: [{ footageId: processing, transition: cut }],
      })
    ).toEqual({ ok: true, data: { version: 1 } })
    for (const footageId of [elsewhere, "missing"]) {
      expect(
        await actions.saveProjectClips({
          projectId,
          baseVersion: 1,
          clips: [{ footageId, transition: cut }],
        })
      ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
    }
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).version
    ).toBe(1)
    // A clip still processing is in the video but plays (and counts) once ready.
    const video = await queries.getProject(workspaceId, projectId)
    expect(video?.clips[0]).toMatchObject({
      status: "PROCESSING",
      lengthMs: 0,
      videoUrl: null,
    })
  })

  it("adds a clip recorded into a video at its end", async () => {
    const projectId = await newProject()
    await actions.saveProjectClips({
      projectId,
      baseVersion: 0,
      clips: [{ footageId: clipA, transition: blur }],
    })
    const recorded = await clip(kitId, { status: "UPLOADING", name: "Take 2" })
    expect(
      await actions.appendProjectClip({ projectId, footageId: recorded })
    ).toEqual({ ok: true, data: { version: 2 } })
    expect(
      (await queries.getProject(workspaceId, projectId))?.clips.map((c) => [
        c.name,
        c.transition.kind,
      ])
    ).toEqual([
      ["Intro", "blur"],
      ["Take 2", "cut"],
    ])
    expect(
      await actions.appendProjectClip({
        projectId,
        footageId: await clip(otherKitId),
      })
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } })
    const names = await queries.getProjectName(workspaceId, projectId)
    expect(names).toMatchObject({ clipCount: 2 })
  })

  it("lists projects with their length and clip count, newest change first", async () => {
    const older = await newProject("Older")
    const newer = await newProject("Newer")
    await actions.saveProjectClips({
      projectId: newer,
      baseVersion: 0,
      clips: [
        { footageId: clipA, transition: cut },
        { footageId: clipB, transition: blur },
      ],
    })
    const list = await queries.listProjects(workspaceId)
    const names = list.map((p) => p.name)
    expect(names.indexOf("Newer")).toBeLessThan(names.indexOf("Older"))
    const item = list.find((p) => p.id === newer)
    // 4s + 5s, overlapping by the 0.5s blur.
    expect(item).toMatchObject({ clipCount: 2, durationMs: 8500 })
    expect(list.find((p) => p.id === older)).toMatchObject({
      clipCount: 0,
      durationMs: 0,
    })
  })

  it("deleting footage takes it out of projects; other workspaces can't see them", async () => {
    const projectId = await newProject()
    const gone = await clip(kitId)
    await actions.saveProjectClips({
      projectId,
      baseVersion: 0,
      clips: [
        { footageId: clipA, transition: cut },
        { footageId: gone, transition: cut },
      ],
    })
    await db.footage.delete({ where: { id: gone } })
    expect(
      (await queries.getProject(workspaceId, projectId))?.clips.map(
        (c) => c.footageId
      )
    ).toEqual([clipA])

    const stranger = await db.workspace.create({ data: { name: "Stranger" } })
    expect(await queries.getProject(stranger.id, projectId)).toBeNull()
    await db.workspace.delete({ where: { id: stranger.id } })
  })
})
