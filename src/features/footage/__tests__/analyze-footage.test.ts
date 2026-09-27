import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { failingModel, modelReturning } from "@/shared/testing/mock-model"

const enqueue = vi.hoisted(() => vi.fn().mockResolvedValue("job-1"))
vi.mock("@/shared/jobs", () => ({ enqueue }))

// Real database, ffmpeg and storage (as process-footage.test.ts); the
// vision model is a mock.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

// Processing, then analysis, with Neon round trips: slower than most.
describe.runIf(hasStorage)("analyzeFootage job", { timeout: 90_000 }, () => {
  let db: typeof import("@/shared/db").db
  let service: typeof import("../service")
  let storage: typeof import("@/shared/storage")
  let media: typeof import("@/shared/media")
  let processFootage: typeof import("../jobs/process-footage").processFootage
  let analyzeFootage: typeof import("../jobs/analyze-footage").analyzeFootage
  let analysisLib: typeof import("../lib/analysis")
  let dir: string
  let video: string
  const workspaceIds: string[] = []
  const folders: string[] = []

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    service = await import("../service")
    storage = await import("@/shared/storage")
    media = await import("@/shared/media")
    ;({ processFootage } = await import("../jobs/process-footage"))
    ;({ analyzeFootage } = await import("../jobs/analyze-footage"))
    analysisLib = await import("../lib/analysis")
    dir = await mkdtemp(join(tmpdir(), "reelpilot-analyze-test-"))

    // 6s: a still grey screen, then from 2.5s a blue panel in the top
    // right blinks (an app reacting to a click), then still again.
    video = join(dir, "app.mp4")
    await media.runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "color=c=0xf5f5f5:duration=6:size=1280x720:rate=30",
        "-vf",
        "drawbox=x=900:y=60:w=300:h=160:color=0x2563eb:t=fill:enable='between(t,2.5,2.9)+between(t,3.3,3.7)'",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        video,
      ],
      { timeoutMs: 60_000 }
    )
  })

  afterEach(async () => {
    for (const folder of folders.splice(0)) await storage.deleteFolder(folder)
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } })
    workspaceIds.length = 0
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const attempt = { signal: new AbortController().signal, isLastAttempt: false }

  /** A READY clip made from the test video, with moments at `marks`. */
  async function readyClip(marks: number[]) {
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
        source: "RECORDING",
      }
    )
    folders.push(originalKey.slice(0, originalKey.lastIndexOf("/") + 1))
    await storage.uploadFromFile(originalKey, video, "video/mp4")
    await service.startProcessing(workspace.id, footageId, marks, {
      version: 1,
      surface: "browser",
      cursor: [[2400, 0.8, 0.2]],
    })
    await processFootage({ footageId }, attempt)
    return { footageId, workspaceId: workspace.id }
  }

  const described = JSON.stringify({
    description: "Export panel open over the invoice list",
    headline: "Export invoices in one click",
    onScreenText: ["Export", "CSV"],
    focus: { x: 896, y: 58, w: 307, h: 166 }, // pixels of 1280×720
    kind: "modal",
  })

  it("maps the action, idle time and colours, then describes each moment", async () => {
    const { footageId } = await readyClip([2400, 5000])
    const clipBefore = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
      include: { markers: { orderBy: { atMs: "asc" } } },
    })
    expect(clipBefore.recording).toMatchObject({ surface: "browser" })
    // The owner already said what happens at 5s: that stays.
    const [first, second] = clipBefore.markers.filter(
      (m) => m.source === "MANUAL"
    )
    await db.footageMarker.update({
      where: { id: second!.id },
      data: { label: "Back to the list" },
    })

    const model = modelReturning(described)
    await analyzeFootage({ footageId }, { ...attempt, model })

    const clip = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
      include: { markers: { orderBy: { atMs: "asc" } } },
    })
    expect(clip.analysisStatus).toBe("READY")
    const analysis = analysisLib.parseStoredAnalysis(clip.analysis)
    expect(analysis).not.toBeNull()

    // Still at the start and at the end.
    expect(analysis!.idle[0]?.startMs).toBe(0)
    expect(analysis!.idle[0]?.endMs).toBeGreaterThanOrEqual(2000)
    // The action at 2.4s is the blue panel (centre ≈ 0.82, 0.19).
    const action = analysisLib.actionAt(analysis!, 2400)
    expect(action?.focusX).toBeCloseTo(0.82, 1)
    expect(action?.focusY).toBeCloseTo(0.19, 1)
    expect(action?.zoom).toBeGreaterThan(1.5)
    // A light app with a blue accent.
    expect(analysis!.palette.isDark).toBe(false)
    expect(analysis!.palette.accents[0]).toMatch(/^#2[0-9a-f]{5}$/)

    // Each moment was described from a picture of the screen.
    const calls = model.doGenerateCalls
    expect(calls.length).toBe(clip.markers.length)
    expect(JSON.stringify(calls[0]?.prompt)).toContain("image/jpeg")
    const moment = clip.markers.find((m) => m.id === first!.id)
    expect(moment?.insight).toMatchObject({
      headline: "Export invoices in one click",
      kind: "modal",
    })
    expect(moment?.label).toBe("Export panel open over the invoice list")
    expect(clip.markers.find((m) => m.id === second!.id)?.label).toBe(
      "Back to the list"
    )

    // Run again: nothing new to describe, the analysis is reused.
    await analyzeFootage({ footageId }, { ...attempt, model })
    expect(model.doGenerateCalls.length).toBe(calls.length)
  })

  it("keeps working when the AI fails, and re-describes on request", async () => {
    const { footageId, workspaceId } = await readyClip([2400])
    await analyzeFootage({ footageId }, { ...attempt, model: failingModel() })

    let clip = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
      include: { markers: true },
    })
    expect(clip.analysisStatus).toBe("READY")
    expect(clip.analysis).not.toBeNull()
    expect(clip.markers.every((m) => m.insight === null)).toBe(true)

    // Described, then "Analyse again": AI labels are refilled, not kept.
    await analyzeFootage(
      { footageId },
      { ...attempt, model: modelReturning(described) }
    )
    expect(
      await service.requestAnalysis(workspaceId, footageId, {
        redescribe: true,
      })
    ).toBe(true)
    clip = await db.footage.findUniqueOrThrow({
      where: { id: footageId },
      include: { markers: true },
    })
    expect(clip.analysisStatus).toBe("PENDING")
    expect(clip.analysis).toBeNull()
    const moment = clip.markers.find((m) => m.atMs === 2400)
    expect(moment).toMatchObject({ insight: null, label: null })
  })

  it("describes a moment again once it moves more than a second", async () => {
    const { footageId, workspaceId } = await readyClip([2400])
    await analyzeFootage(
      { footageId },
      { ...attempt, model: modelReturning(described) }
    )
    const marker = await db.footageMarker.findFirstOrThrow({
      where: { footageId, atMs: 2400 },
    })
    expect(
      await service.moveMarker(workspaceId, marker.id, 2900)
    ).toMatchObject({ needsInsight: false })
    expect(
      await service.moveMarker(workspaceId, marker.id, 4500)
    ).toMatchObject({ footageId, needsInsight: true })
    expect(
      (await db.footageMarker.findUniqueOrThrow({ where: { id: marker.id } }))
        .insight
    ).toBeNull()
  })
})
