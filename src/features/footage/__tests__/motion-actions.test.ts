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

import { defaultPresentation, shotPresets } from "@/shared/motion"

// Replaced: the signed-in user, Next's cache and the AI. The rest is real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const generateStructured = vi.fn()
vi.mock("@/shared/ai", () => ({ generateStructured }))

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDatabase)("footage motion actions", () => {
  const userId = `test-${randomUUID()}`
  let db: typeof import("@/shared/db").db
  let actions: typeof import("../actions")
  let workspaceId: string
  let kitId: string
  let footageId: string
  let markerId: string

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
      data: {
        workspaceId,
        name: "Acme",
        url: "https://acme.app/",
        colors: { primary: "#ff5a1f", secondary: "#2f6bff" },
      },
    }))
  })

  beforeEach(async () => {
    requireUser.mockResolvedValue({ user: { id: userId, name: "Ada" } })
    const clip = await db.footage.create({
      data: {
        workspaceId,
        brandKitId: kitId,
        name: "Demo",
        source: "UPLOAD",
        status: "READY",
        originalKey: "k",
        contentType: "video/mp4",
        sizeBytes: 1,
        durationMs: 10_000,
        markers: { create: { atMs: 2000, source: "AUTO", label: "Dashboard" } },
      },
      include: { markers: true },
    })
    footageId = clip.id
    markerId = clip.markers[0]?.id ?? ""
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await db.footage.deleteMany({ where: { brandKitId: kitId } })
    await db.rateLimitBucket.deleteMany({
      where: { key: `motion-direction:${workspaceId}` },
    })
  })

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } })
  })

  const shot = {
    camera: shotPresets.dramatic.camera,
    transitionMs: 900,
    easing: "smooth" as const,
    drift: 0,
  }

  it("saves and clears a marker's shot", async () => {
    expect(await actions.updateMarkerShot({ markerId, shot })).toEqual({
      ok: true,
      data: null,
    })
    expect(
      (await db.footageMarker.findUniqueOrThrow({ where: { id: markerId } }))
        .shot
    ).toEqual(shot)

    await actions.updateMarkerShot({ markerId, shot: null })
    expect(
      (await db.footageMarker.findUniqueOrThrow({ where: { id: markerId } }))
        .shot
    ).toBeNull()
  })

  it("refuses a camera outside its limits", async () => {
    const result = await actions.updateMarkerShot({
      markerId,
      shot: { ...shot, camera: { ...shot.camera, turn: 180 } },
    })
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })

  it("saves the clip's presentation", async () => {
    const presentation = {
      ...defaultPresentation,
      frame: { radius: 4, shadow: false, padding: 0.2 },
    }

    expect(
      await actions.updateFootagePresentation({ footageId, presentation })
    ).toEqual({
      ok: true,
      data: null,
    })
    expect(
      (await db.footage.findUniqueOrThrow({ where: { id: footageId } }))
        .presentation
    ).toEqual(presentation)
  })

  it("never touches another workspace's markers", async () => {
    const other = await db.workspace.create({ data: { name: "Other" } })
    const otherKit = await db.brandKit.create({
      data: { workspaceId: other.id, name: "X", url: "https://x.app/" },
    })
    const theirs = await db.footage.create({
      data: {
        workspaceId: other.id,
        brandKitId: otherKit.id,
        name: "Theirs",
        source: "UPLOAD",
        originalKey: "k",
        contentType: "video/mp4",
        sizeBytes: 1,
        markers: { create: { atMs: 0, source: "AUTO" } },
      },
      include: { markers: true },
    })
    try {
      expect(
        await actions.updateMarkerShot({
          markerId: theirs.markers[0]?.id,
          shot,
        })
      ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } })
    } finally {
      await db.workspace.delete({ where: { id: other.id } })
    }
  })

  const scope = {
    camera: true,
    cuts: true,
    text: true,
    graphics: true,
    lens: true,
  }

  it("returns a cleaned whole-edit plan from the AI", async () => {
    generateStructured.mockResolvedValue({
      look: "tour",
      take: 1,
      stillParts: "keep",
      textStyle: "word-rise",
      texts: [
        {
          markerId,
          role: "headline",
          text: "Every invoice, on time",
          emphasis: "on time",
        },
      ],
      graphics: [
        { markerId: "someone-elses", template: "magnify", label: "x" },
      ],
      endCard: null,
      lens: "sharp",
      reasoning: "Clear and calm.",
    })

    const result = await actions.directFootageEdit({
      footageId,
      instruction: "A calm feature tour",
      scope,
    })

    expect(result).toMatchObject({
      ok: true,
      data: { look: "tour", texts: [{ markerId }], graphics: [] },
    })
    // The prompt carried the brand kit.
    expect(generateStructured.mock.calls[0]?.[0].prompt).toContain(
      "Brand: Acme"
    )
  })

  it("asks for a key moment before directing", async () => {
    await db.footageMarker.deleteMany({ where: { footageId } })

    expect(
      await actions.directFootageEdit({ footageId, instruction: "Go", scope })
    ).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", message: /key moment/ },
    })
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it("needs something in scope, and stops after the daily AI limit", async () => {
    expect(
      await actions.directFootageEdit({
        footageId,
        instruction: "Go",
        scope: {
          camera: false,
          cuts: false,
          text: false,
          graphics: false,
          lens: false,
        },
      })
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
    await db.rateLimitBucket.create({
      data: {
        key: `motion-direction:${workspaceId}`,
        count: 40,
        windowStart: new Date(),
      },
    })
    expect(
      await actions.directFootageEdit({ footageId, instruction: "Go", scope })
    ).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } })
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it("moves a moment to a new time; a moved auto moment becomes manual", async () => {
    expect(await actions.moveFootageMarker({ markerId, atMs: 6500 })).toEqual({
      ok: true,
      data: null,
    })
    expect(
      await db.footageMarker.findUniqueOrThrow({ where: { id: markerId } })
    ).toMatchObject({
      atMs: 6500,
      source: "MANUAL",
    })
  })

  it("won't move a moment past the end of the clip", async () => {
    expect(
      await actions.moveFootageMarker({ markerId, atMs: 99_000 })
    ).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    })
  })
})
