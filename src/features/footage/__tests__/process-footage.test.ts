import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

// Real database, real ffmpeg and real storage: runs where a bucket exists
// (NEON_BRANCH locally; STORAGE_TESTS in CI with MinIO).
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

describe.runIf(hasStorage)("processFootage job", () => {
  let db: typeof import("@/shared/db").db
  let service: typeof import("../service")
  let storage: typeof import("@/shared/storage")
  let media: typeof import("@/shared/media")
  let processFootage: typeof import("../jobs/process-footage").processFootage
  let dir: string
  const workspaceIds: string[] = []
  const folders: string[] = []

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    service = await import("../service")
    storage = await import("@/shared/storage")
    media = await import("@/shared/media")
    ;({ processFootage } = await import("../jobs/process-footage"))
    dir = await mkdtemp(join(tmpdir(), "reelpilot-process-test-"))
  })

  afterEach(async () => {
    for (const folder of folders.splice(0)) {
      await storage.deleteFolder(folder)
    }
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } })
    workspaceIds.length = 0
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const attempt = { signal: new AbortController().signal, isLastAttempt: false }

  /** Creates a PROCESSING clip whose original is `file`. */
  async function clipFrom(file: string, contentType = "video/mp4") {
    const workspace = await db.workspace.create({ data: { name: "T" } })
    workspaceIds.push(workspace.id)
    const kit = await db.brandKit.create({
      data: {
        workspaceId: workspace.id,
        name: "Acme",
        url: "https://acme.app/",
      },
    })
    const { footageId, originalKey } = await service.createFootageUpload(
      workspace.id,
      {
        kitId: kit.id,
        name: "Demo",
        sizeBytes: 1,
        contentType: "video/mp4",
        source: "UPLOAD",
      }
    )
    folders.push(originalKey.slice(0, originalKey.lastIndexOf("/") + 1))
    await storage.uploadFromFile(originalKey, file, contentType)
    await service.startProcessing(workspace.id, footageId, [1000])
    return footageId
  }

  it("converts a clip, makes thumbnails and finds the cut", async () => {
    // 3s test pattern, a hard cut, then 3s colour bars, with sound.
    const file = join(dir, "cut.mov")
    await media.runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=3:size=1280x720:rate=30",
        "-f",
        "lavfi",
        "-i",
        "smptebars=duration=3:size=1280x720:rate=30",
        "-f",
        "lavfi",
        "-i",
        "sine=duration=6",
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1[v]",
        "-map",
        "[v]",
        "-map",
        "2:a",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        file,
      ],
      { timeoutMs: 60_000 }
    )
    const footageId = await clipFrom(file, "video/quicktime")

    await processFootage({ footageId }, attempt)

    const clip = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
      include: { markers: { orderBy: { atMs: "asc" } } },
    })
    expect(clip).toMatchObject({ status: "READY", width: 1280, height: 720 })
    expect(clip.durationMs).toBeGreaterThan(5800)
    expect(clip.thumbnailCount).toBe(6)
    // The cut at 3s is found; the recorded mark at 1s is kept.
    expect(clip.markers.map((m) => m.source)).toContain("MANUAL")
    const auto = clip.markers.filter((m) => m.source === "AUTO")
    expect(auto.some((m) => Math.abs(m.atMs - 3000) <= 100)).toBe(true)

    // The converted video is a silent H.264 MP4 in storage.
    const out = join(dir, "out.mp4")
    await storage.downloadToFile(clip.videoKey ?? "", out)
    expect(await media.probeVideo(out)).toMatchObject({
      codec: "h264",
      hasAudio: false,
    })
    expect(await storage.fileSize(clip.posterKey ?? "")).toBeGreaterThan(0)
    expect(await storage.fileSize(clip.thumbnailsKey ?? "")).toBeGreaterThan(0)
  })

  it("handles a browser recording that has no duration in its header", async () => {
    // `-live 1` writes WebM the way MediaRecorder does: no duration, no cues.
    const file = join(dir, "recording.webm")
    await media.runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=3:size=640x400:rate=30",
        "-c:v",
        "libvpx",
        "-deadline",
        "realtime",
        "-b:v",
        "500k",
        "-live",
        "1",
        "-f",
        "webm",
        file,
      ],
      { timeoutMs: 60_000 }
    )
    expect((await media.probeVideo(file))?.durationMs).toBe(0)
    const footageId = await clipFrom(file, "video/webm")

    await processFootage({ footageId }, attempt)

    const clip = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
    })
    expect(clip.status).toBe("READY")
    expect(clip.durationMs).toBeGreaterThan(2900)
  })

  it("fails a file that isn't a video, without retrying", async () => {
    const file = join(dir, "fake.mp4")
    await writeFile(file, "<svg onload=alert(1)>")
    const footageId = await clipFrom(file)

    await expect(
      processFootage({ footageId }, attempt)
    ).resolves.toBeUndefined()

    expect(
      await db.footage.findUniqueOrThrow({ where: { id: footageId } })
    ).toMatchObject({
      status: "FAILED",
      errorMessage: expect.stringContaining(
        "couldn’t read this file as a video"
      ),
    })
  })

  it("fails a clip longer than the plan allows, with the plan's message", async () => {
    const file = join(dir, "long.mp4")
    await media.runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:duration=185:size=64x64:rate=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        file,
      ],
      { timeoutMs: 60_000 }
    )
    const footageId = await clipFrom(file) // Free plan: 3 minutes

    await processFootage({ footageId }, attempt)

    expect(
      (await db.footage.findUniqueOrThrow({ where: { id: footageId } }))
        .errorMessage
    ).toBe(
      "Your footage is longer than 3 minutes. Trim it or upload a shorter clip."
    )
  })

  it("does nothing for a clip that was deleted meanwhile", async () => {
    await expect(
      processFootage({ footageId: "gone" }, attempt)
    ).resolves.toBeUndefined()
  })
})
