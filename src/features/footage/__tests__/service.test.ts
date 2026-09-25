import { afterEach, beforeAll, describe, expect, it } from "vitest"

import type { Plan } from "@/shared/db"

// Needs a database; skipped when DATABASE_URL is unset.
const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDatabase)("footage service", () => {
  let db: typeof import("@/shared/db").db
  let service: typeof import("../service")
  let queries: typeof import("../queries")

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    service = await import("../service")
    queries = await import("../queries")
  })

  const workspaceIds: string[] = []
  afterEach(async () => {
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } })
    workspaceIds.length = 0
  })

  async function kitIn(plan: Plan = "FREE") {
    const workspace = await db.workspace.create({ data: { name: "T", plan } })
    workspaceIds.push(workspace.id)
    const kit = await db.brandKit.create({
      data: {
        workspaceId: workspace.id,
        name: "Acme",
        url: "https://acme.app/",
      },
    })
    return { workspaceId: workspace.id, kitId: kit.id }
  }

  const upload = (kitId: string, overrides = {}) => ({
    kitId,
    name: "Demo",
    sizeBytes: 5_000_000,
    contentType: "video/mp4" as const,
    source: "UPLOAD" as const,
    ...overrides,
  })

  it("creates an uploading clip with a key under its kit folder", async () => {
    const { workspaceId, kitId } = await kitIn()

    const { footageId, originalKey } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )

    expect(originalKey).toBe(
      `workspaces/${workspaceId}/brand-kits/${kitId}/footage/${footageId}/original.mp4`
    )
    const clip = await queries.getFootage(workspaceId, footageId)
    expect(clip).toMatchObject({
      status: "UPLOADING",
      originalKey,
      name: "Demo",
    })
  })

  it("refuses files over the plan's size cap", async () => {
    const { workspaceId, kitId } = await kitIn("FREE")

    await expect(
      service.createFootageUpload(
        workspaceId,
        upload(kitId, { sizeBytes: 300 * 1024 * 1024 })
      )
    ).rejects.toMatchObject({ code: "VALIDATION" })
  })

  it("holds the clips-per-kit limit under parallel uploads", async () => {
    const { workspaceId, kitId } = await kitIn("FREE") // 5 clips per kit

    const results = await Promise.allSettled(
      Array.from({ length: 7 }, () =>
        service.createFootageUpload(workspaceId, upload(kitId))
      )
    )

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5)
    expect(await db.footage.count({ where: { brandKitId: kitId } })).toBe(5)
  })

  it("never creates a clip in another workspace's kit", async () => {
    const { kitId } = await kitIn()
    const other = await kitIn()

    await expect(
      service.createFootageUpload(other.workspaceId, upload(kitId))
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("moves UPLOADING → PROCESSING once, keeping recorded marks", async () => {
    const { workspaceId, kitId } = await kitIn()
    const { footageId } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )

    expect(
      await service.startProcessing(workspaceId, footageId, [3000, 1000, 3000])
    ).toBe(true)
    expect(await service.startProcessing(workspaceId, footageId, [5000])).toBe(
      false
    )

    const clip = await queries.getFootage(workspaceId, footageId)
    expect(clip?.status).toBe("PROCESSING")
    expect(clip?.markers.map((m) => [m.atMs, m.source])).toEqual([
      [1000, "MANUAL"],
      [3000, "MANUAL"],
    ])
  })

  it("saves the processed clip; a retry replaces auto markers only", async () => {
    const { workspaceId, kitId } = await kitIn()
    const { footageId } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )
    await service.startProcessing(workspaceId, footageId, [2000, 99_000])
    const result = {
      durationMs: 10_000,
      width: 1920,
      height: 1080,
      thumbnailCount: 10,
      thumbnailIntervalMs: 1000,
      autoMarkersMs: [4000, 8000],
    }

    await service.saveProcessedFootage(footageId, result)
    await service.saveProcessedFootage(footageId, result) // job retried

    const clip = await queries.getFootage(workspaceId, footageId)
    expect(clip).toMatchObject({
      status: "READY",
      durationMs: 10_000,
      videoKey: expect.stringMatching(/\/video\.mp4$/),
      posterKey: expect.stringMatching(/\/poster\.jpg$/),
    })
    // The mark past the real end (99s) is dropped; auto markers not doubled.
    expect(clip?.markers.map((m) => [m.atMs, m.source])).toEqual([
      [2000, "MANUAL"],
      [4000, "AUTO"],
      [8000, "AUTO"],
    ])
  })

  it("fails a clip with a message the user can act on", async () => {
    const { workspaceId, kitId } = await kitIn()
    const { footageId } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )

    await service.failFootage(footageId, "Not a video.")
    const failed = await queries.getFootage(workspaceId, footageId)
    expect(failed).toMatchObject({
      status: "FAILED",
      errorMessage: "Not a video.",
    })
  })

  it("fails uploads that never finished", async () => {
    const { workspaceId, kitId } = await kitIn()
    const { footageId } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )

    await service.failStaleUploads(new Date(Date.now() + 1000))

    expect((await queries.getFootage(workspaceId, footageId))?.status).toBe(
      "FAILED"
    )
  })

  it("adds, relabels and deletes markers only within the workspace", async () => {
    const { workspaceId, kitId } = await kitIn()
    const other = await kitIn()
    const { footageId } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )
    await service.startProcessing(workspaceId, footageId, [])
    await service.saveProcessedFootage(footageId, {
      durationMs: 5000,
      width: 100,
      height: 100,
      thumbnailCount: 5,
      thumbnailIntervalMs: 1000,
      autoMarkersMs: [],
    })

    await expect(
      service.addMarker(workspaceId, { footageId, atMs: 6000, label: null })
    ).rejects.toMatchObject({ code: "VALIDATION" })
    const { id } = await service.addMarker(workspaceId, {
      footageId,
      atMs: 2500,
      label: "Dashboard",
    })
    await expect(
      service.updateMarkerLabel(other.workspaceId, id, "Hijack")
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await service.updateMarkerLabel(workspaceId, id, "Reports")
    expect(
      (await queries.getFootage(workspaceId, footageId))?.markers[0]?.label
    ).toBe("Reports")
    await expect(
      service.deleteMarker(other.workspaceId, id)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    await service.deleteMarker(workspaceId, id)
    expect((await queries.getFootage(workspaceId, footageId))?.markers).toEqual(
      []
    )
  })

  it("deletes a clip and returns its storage folder", async () => {
    const { workspaceId, kitId } = await kitIn()
    const { footageId } = await service.createFootageUpload(
      workspaceId,
      upload(kitId)
    )

    expect(await service.deleteFootage(workspaceId, footageId)).toEqual({
      folder: `workspaces/${workspaceId}/brand-kits/${kitId}/footage/${footageId}/`,
    })
    expect(await queries.listFootage(workspaceId, kitId)).toEqual([])
  })
})
