import { randomUUID } from "node:crypto"

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

// Replaced: the signed-in user, Next's cache, the job queue and storage.
// Validation, permissions, limits and database writes are real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const enqueue = vi.fn()
vi.mock("@/shared/jobs", () => ({ enqueue }))

const signedFileUpload = vi.fn()
const fileSize = vi.fn()
const deleteFolder = vi.fn()
vi.mock("@/shared/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/storage")>()),
  signedFileUpload,
  fileSize,
  deleteFolder,
}))

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDatabase)("footage actions", () => {
  const userId = `test-${randomUUID()}`
  let db: typeof import("@/shared/db").db
  let actions: typeof import("../actions")
  let workspaceId: string
  let kitId: string

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    actions = await import("../actions")
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

  beforeEach(() => {
    requireUser.mockResolvedValue({ user: { id: userId, name: "Ada" } })
    signedFileUpload.mockResolvedValue({
      url: "https://storage.example/media",
      fields: { key: "k", Policy: "p" },
    })
    fileSize.mockResolvedValue(1_000)
    deleteFolder.mockResolvedValue(undefined)
    enqueue.mockResolvedValue("job-1")
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await db.footage.deleteMany({ where: { brandKitId: kitId } })
    await db.membership.updateMany({
      where: { workspaceId },
      data: { role: "OWNER" },
    })
  })

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } })
  })

  const request = (overrides: Record<string, unknown> = {}) =>
    actions.requestFootageUpload({
      kitId,
      name: "Demo.mp4",
      sizeBytes: 1_000,
      contentType: "video/mp4",
      source: "UPLOAD",
      ...overrides,
    })

  async function uploaded() {
    const result = await request()
    if (!result.ok) throw new Error(result.error.message)
    return result.data.footageId
  }

  it("signs an upload capped at the declared size", async () => {
    const result = await request()

    expect(result).toMatchObject({
      ok: true,
      data: { upload: { url: "https://storage.example/media" } },
    })
    const clip = await db.footage.findFirstOrThrow({
      where: { brandKitId: kitId },
    })
    expect(signedFileUpload).toHaveBeenCalledWith(clip.originalKey, {
      maxBytes: 1_000,
      contentType: "video/mp4",
      expiresInSeconds: 3600,
    })
  })

  it("explains a wrong file type", async () => {
    expect(await request({ contentType: "image/gif" })).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Upload an MP4, MOV or WebM video.",
      },
    })
    expect(signedFileUpload).not.toHaveBeenCalled()
  })

  it("refuses viewers", async () => {
    await db.membership.updateMany({
      where: { workspaceId },
      data: { role: "VIEWER" },
    })

    expect(await request()).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    })
  })

  it("queues processing once the file has arrived", async () => {
    const footageId = await uploaded()

    const result = await actions.completeFootageUpload({
      footageId,
      recordedMarksMs: [1500],
    })

    expect(result).toEqual({ ok: true, data: null })
    const { processFootageJob } = await import("../jobs/definitions")
    expect(enqueue).toHaveBeenCalledWith(
      processFootageJob,
      { footageId },
      { singletonKey: footageId }
    )
    const clip = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
      include: { markers: true },
    })
    expect(clip.status).toBe("PROCESSING")
    expect(clip.markers).toMatchObject([{ atMs: 1500, source: "MANUAL" }])
  })

  it("doesn't queue twice when the browser repeats itself", async () => {
    const footageId = await uploaded()

    await actions.completeFootageUpload({ footageId })
    await actions.completeFootageUpload({ footageId })

    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["missing", null],
    ["bigger than declared", 5_000],
  ])("fails the clip when the stored file is %s", async (_label, size) => {
    const footageId = await uploaded()
    fileSize.mockResolvedValue(size)

    expect(await actions.completeFootageUpload({ footageId })).toMatchObject({
      ok: false,
      error: { message: "The upload didn’t finish. Upload the clip again." },
    })
    expect(enqueue).not.toHaveBeenCalled()
    expect(
      (await db.footage.findUniqueOrThrow({ where: { id: footageId } })).status
    ).toBe("FAILED")
  })

  it("deletes the clip and its files", async () => {
    const footageId = await uploaded()

    expect(await actions.deleteFootage(footageId)).toEqual({
      ok: true,
      data: null,
    })
    expect(deleteFolder).toHaveBeenCalledWith(
      `workspaces/${workspaceId}/brand-kits/${kitId}/footage/${footageId}/`
    )
    expect(await db.footage.count({ where: { id: footageId } })).toBe(0)
  })

  it("manages markers on a ready clip", async () => {
    const footageId = await uploaded()
    await db.footage.update({
      where: { id: footageId },
      data: { status: "READY", durationMs: 10_000 },
    })

    const added = await actions.addFootageMarker({
      footageId,
      atMs: 4200,
      label: "Reports",
    })
    expect(added).toMatchObject({ ok: true })
    if (!added.ok) return
    expect(
      await actions.updateFootageMarker({
        markerId: added.data.markerId,
        label: "Reports page",
      })
    ).toEqual({ ok: true, data: null })
    expect(await actions.deleteFootageMarker(added.data.markerId)).toEqual({
      ok: true,
      data: null,
    })
    expect(await db.footageMarker.count({ where: { footageId } })).toBe(0)
  })

  it("queues the smart analysis for a new moment, and on request", async () => {
    const footageId = await uploaded()
    await db.footage.update({
      where: { id: footageId },
      data: { status: "READY", durationMs: 10_000, analysisStatus: "READY" },
    })
    const analyzeCall = [
      expect.objectContaining({ name: "footage.analyze" }),
      { footageId },
      { singletonKey: footageId },
    ]

    // A new moment gets described.
    await actions.addFootageMarker({ footageId, atMs: 1000 })
    expect(enqueue).toHaveBeenCalledWith(...analyzeCall)
    expect(
      (await db.footage.findUniqueOrThrow({ where: { id: footageId } }))
        .analysisStatus
    ).toBe("PENDING")

    // "Analyse again" starts over.
    enqueue.mockClear()
    await db.footage.update({
      where: { id: footageId },
      data: { analysisStatus: "READY" },
    })
    expect(await actions.analyzeFootageAgain(footageId)).toEqual({
      ok: true,
      data: null,
    })
    expect(enqueue).toHaveBeenCalledWith(...analyzeCall)

    // A queue hiccup doesn't fail the edit (the sweep re-queues it).
    enqueue.mockRejectedValueOnce(new Error("queue down"))
    expect(
      await actions.addFootageMarker({ footageId, atMs: 2000 })
    ).toMatchObject({
      ok: true,
    })
  })

  it("won't analyse a clip that isn't ready, or for viewers", async () => {
    const footageId = await uploaded()
    expect(await actions.analyzeFootageAgain(footageId)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    })
    await db.membership.updateMany({
      where: { workspaceId },
      data: { role: "VIEWER" },
    })
    expect(await actions.analyzeFootageAgain(footageId)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    })
    expect(enqueue).not.toHaveBeenCalled()
  })
})
