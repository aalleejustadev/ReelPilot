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

// Replaced: the signed-in user, Next's cache and the job queue. The rest
// (database, services, signing) is real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const enqueue = vi.hoisted(() => vi.fn().mockResolvedValue("job-1"))
vi.mock("@/shared/jobs", () => ({ enqueue }))

const hasDatabase = Boolean(process.env.DATABASE_URL)
// Download links are signed with the bucket's credentials.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

describe.runIf(hasDatabase && hasStorage)("exports", () => {
  const userId = `test-${randomUUID()}`
  let db: typeof import("@/shared/db").db
  let actions: typeof import("../actions")
  let service: typeof import("../service")
  let queries: typeof import("../queries")
  let workspaceId: string
  let kitId: string

  const clip = async (overrides: Record<string, unknown> = {}) =>
    (
      await db.footage.create({
        data: {
          workspaceId,
          brandKitId: kitId,
          name: "Demo",
          source: "UPLOAD",
          status: "READY",
          originalKey: "k",
          videoKey: `workspaces/${workspaceId}/v.mp4`,
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
    service = await import("../service")
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
  })

  beforeEach(() => enqueue.mockClear())

  afterAll(async () => {
    await db.workspace.deleteMany({ where: { id: workspaceId } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  it("queues one render per clip and shape, and shows it running", async () => {
    const id = await clip()
    const target = { kind: "clip", id } as const

    const first = await actions.startExport({ target, shape: "9:16" })
    expect(first.ok && first.data.exports["9:16"]).toMatchObject({
      status: "QUEUED",
      file: null,
    })
    expect(enqueue).toHaveBeenCalledTimes(1)
    const [job, data] = enqueue.mock.calls[0]!
    expect(job).toMatchObject({ name: "exports.render" })

    // A second click while it runs doesn't render twice.
    await actions.startExport({ target, shape: "9:16" })
    expect(enqueue).toHaveBeenCalledTimes(1)
    // Another shape is its own export.
    await actions.startExport({ target, shape: "1:1" })
    expect(enqueue).toHaveBeenCalledTimes(2)

    const row = await db.export.findUniqueOrThrow({
      where: { id: (data as { exportId: string }).exportId },
    })
    expect(row).toMatchObject({ footageId: id, name: "Demo", shape: "9:16" })
  })

  it("refuses a clip that isn't ready, an empty video and others' clips", async () => {
    const processing = await clip({ status: "PROCESSING", videoKey: null })
    const notReady = await actions.startExport({
      target: { kind: "clip", id: processing },
      shape: "16:9",
    })
    expect(notReady).toMatchObject({
      ok: false,
      error: { message: "Wait until every clip has finished processing." },
    })

    const { id: empty } = await db.project.create({
      data: { workspaceId, brandKitId: kitId, name: "Empty" },
    })
    const emptyVideo = await actions.startExport({
      target: { kind: "video", id: empty },
      shape: "16:9",
    })
    expect(emptyVideo).toMatchObject({
      ok: false,
      error: { message: "Add a clip to the video first." },
    })

    const missing = await actions.startExport({
      target: { kind: "clip", id: "not-a-clip" },
      shape: "16:9",
    })
    expect(missing).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it("keeps the newest finished file per shape, and knows when it's out of date", async () => {
    const id = await clip()
    const target = { kind: "clip", id } as const
    const exportOnce = async () => {
      await actions.startExport({ target, shape: "16:9" })
      const { exportId } = enqueue.mock.lastCall![1] as { exportId: string }
      const input = await (
        await import("../lib/render-input")
      ).loadRenderInput(workspaceId, target, { linkSeconds: 60 })
      const { renderFingerprint } = await import("../lib/fingerprint")
      await service.markRendering(exportId, renderFingerprint(input!.stage))
      await service.finishExport(exportId, {
        key: `workspaces/${workspaceId}/${exportId}.mp4`,
        sizeBytes: 1234,
        durationMs: 4000,
      })
      return exportId
    }

    const first = await exportOnce()
    const second = await exportOnce()
    // The older export (row) is gone.
    expect(await db.export.count({ where: { id: first } })).toBe(0)

    let panel = await actions.exportPanel(target)
    expect(panel.ok && panel.data.exports["16:9"]).toMatchObject({
      status: "READY",
      file: { sizeBytes: 1234, current: true },
    })
    // Downloads through our route, under the clip's name.
    expect(panel.ok && panel.data.exports["16:9"]!.file!.downloadUrl).toBe(
      `/api/exports/${second}/download`
    )
    expect(await queries.getExportFile(workspaceId, second)).toMatchObject({
      fileName: "Demo 16x9.mp4",
    })
    expect(await queries.getExportFile("another-workspace", second)).toBeNull()

    // Edited since: still downloadable, marked out of date.
    await db.footage.update({
      where: { id },
      data: {
        presentation: JSON.parse(
          JSON.stringify({
            ...(await import("@/shared/motion")).defaultPresentation,
            animatedBackground: true,
          })
        ),
      },
    })
    panel = await actions.exportPanel(target)
    expect(panel.ok && panel.data.exports["16:9"]?.file?.current).toBe(false)

    // A newer attempt that fails keeps the finished file available.
    await actions.startExport({ target, shape: "16:9" })
    const { exportId: failing } = enqueue.mock.lastCall![1] as {
      exportId: string
    }
    await service.failExport(failing, "Nope.")
    panel = await actions.exportPanel(target)
    expect(panel.ok && panel.data.exports["16:9"]).toMatchObject({
      status: "FAILED",
      errorMessage: "Nope.",
      file: { sizeBytes: 1234 },
    })
    expect(await db.export.count({ where: { id: second } })).toBe(1)
  })

  it("shares a link that plays the newest export, and turns it off", async () => {
    const id = await clip({ name: "Tour" })
    const target = { kind: "clip", id } as const

    const on = await actions.setShareLink({ target, enabled: true })
    const token = on.ok ? on.data.share!.token : ""
    expect(token).toMatch(/^[\w-]{20,}$/)

    // Nothing exported yet: the page says so.
    expect(await queries.getSharedVideo(token)).toMatchObject({
      name: "Tour",
      video: null,
    })

    const { id: exportId } = await service.createExport(
      workspaceId,
      target,
      "9:16",
      "Tour"
    )
    await service.finishExport(exportId, {
      key: `workspaces/${workspaceId}/${exportId}.mp4`,
      sizeBytes: 1,
      durationMs: 1000,
    })
    const shared = await queries.getSharedVideo(token)
    expect(shared?.video?.shape).toBe("9:16")
    expect(shared?.video?.url).toContain(`${exportId}.mp4`)

    // Off: the link stops working. On again: the same link comes back.
    await actions.setShareLink({ target, enabled: false })
    expect(await queries.getSharedVideo(token)).toBeNull()
    const again = await actions.setShareLink({ target, enabled: true })
    expect(again.ok && again.data.share?.token).toBe(token)
    expect(await queries.getSharedVideo("not-a-token")).toBeNull()
  })

  it("exports and shares a video as a whole", async () => {
    const a = await clip()
    const b = await clip()
    const { id: videoId } = await db.project.create({
      data: {
        workspaceId,
        brandKitId: kitId,
        name: "Launch",
        clips: {
          create: [
            { footageId: a, position: 0, transition: {} },
            { footageId: b, position: 1, transition: {} },
          ],
        },
      },
    })
    const target = { kind: "video", id: videoId } as const
    const started = await actions.startExport({ target, shape: "16:9" })
    expect(started.ok).toBe(true)
    const { exportId } = enqueue.mock.lastCall![1] as { exportId: string }
    expect(
      await db.export.findUniqueOrThrow({ where: { id: exportId } })
    ).toMatchObject({
      projectId: videoId,
      footageId: null,
      name: "Launch",
    })
    const shared = await actions.setShareLink({ target, enabled: true })
    expect(shared.ok && shared.data.share?.enabled).toBe(true)
  })
})
