import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

// Real database, real storage and a real render (headless Chrome +
// Remotion's ffmpeg): runs where a bucket exists.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

describe.runIf(hasStorage)("renderExport job", () => {
  let db: typeof import("@/shared/db").db
  let storage: typeof import("@/shared/storage")
  let media: typeof import("@/shared/media")
  let service: typeof import("../service")
  let renderExport: typeof import("../jobs/render-export").renderExport
  let dir: string
  let workspaceId: string
  let folder: string

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    storage = await import("@/shared/storage")
    media = await import("@/shared/media")
    service = await import("../service")
    ;({ renderExport } = await import("../jobs/render-export"))
    dir = await mkdtemp(join(tmpdir(), "reelpilot-export-test-"))
    ;({ id: workspaceId } = await db.workspace.create({ data: { name: "T" } }))
  })

  afterAll(async () => {
    if (folder) await storage.deleteFolder(folder)
    await db.workspace.deleteMany({ where: { id: workspaceId } })
    await rm(dir, { recursive: true, force: true })
  })

  const attempt = { signal: new AbortController().signal, isLastAttempt: false }

  it("renders a clip in the chosen shape, stores it and marks it ready", async () => {
    const kit = await db.brandKit.create({
      data: {
        workspaceId,
        name: "Acme",
        url: "https://acme.app/",
        fonts: { heading: "Bebas Neue" },
      },
    })
    // A 3s, 1280×720 test pattern, like a processed clip.
    const source = join(dir, "video.mp4")
    await media.runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=3:size=1280x720:rate=30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        source,
      ],
      { timeoutMs: 60_000 }
    )
    const footage = await db.footage.create({
      data: {
        workspaceId,
        brandKitId: kit.id,
        name: "Demo",
        source: "UPLOAD",
        status: "READY",
        originalKey: "k",
        contentType: "video/mp4",
        sizeBytes: 1,
        durationMs: 3000,
        width: 1280,
        height: 720,
      },
    })
    folder = `${storage.workspaceFileKey(workspaceId, "brand-kits", kit.id, "footage", footage.id)}/`
    const videoKey = `${folder}video.mp4`
    await storage.uploadFromFile(videoKey, source, "video/mp4")
    await db.footage.update({ where: { id: footage.id }, data: { videoKey } })

    const { id: exportId } = await service.createExport(
      workspaceId,
      { kind: "clip", id: footage.id },
      "9:16",
      "Demo"
    )
    await renderExport({ exportId }, attempt)

    const done = await db.export.findUniqueOrThrow({ where: { id: exportId } })
    expect(done).toMatchObject({ status: "READY", progress: 1 })
    expect(done.fileKey).toBe(`${folder}exports/${exportId}.mp4`)
    expect(done.sizeBytes).toBeGreaterThan(1000)
    expect(done.fingerprint).toMatch(/^[0-9a-f]{32}$/)

    // The stored file is a portrait 1080×1920 MP4 of the edit's length.
    const output = join(dir, "export.mp4")
    await storage.downloadToFile(done.fileKey!, output)
    const info = await media.probeVideo(output)
    expect(info).toMatchObject({ width: 1080, height: 1920 })
    expect(Math.abs(info!.durationMs - done.durationMs!)).toBeLessThan(100)

    // Done: a second run of the same job does nothing.
    await renderExport({ exportId }, attempt)
    expect(
      (await db.export.findUniqueOrThrow({ where: { id: exportId } })).status
    ).toBe("READY")
  }, 300_000)

  it("fails at once when the clip can't be exported", async () => {
    const kit = await db.brandKit.findFirstOrThrow({ where: { workspaceId } })
    const footage = await db.footage.create({
      data: {
        workspaceId,
        brandKitId: kit.id,
        name: "Broken",
        source: "UPLOAD",
        status: "FAILED",
        originalKey: "k",
        contentType: "video/mp4",
        sizeBytes: 1,
      },
    })
    const { id: exportId } = await service.createExport(
      workspaceId,
      { kind: "clip", id: footage.id },
      "16:9",
      "Broken"
    )
    await renderExport({ exportId }, attempt)
    expect(
      await db.export.findUniqueOrThrow({ where: { id: exportId } })
    ).toMatchObject({
      status: "FAILED",
      errorMessage: "This clip couldn’t be processed, so it can’t be exported.",
    })
  })
})
