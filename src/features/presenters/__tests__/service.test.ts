import { randomUUID } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import type { StockPresenter } from "../lib/catalog"

// Real database; storage and the voice engine are replaced.
const putFile = vi.fn()
const deleteFile = vi.fn()
vi.mock("@/shared/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/storage")>()),
  putFile,
  deleteFile,
}))

const hasDatabase = Boolean(process.env.DATABASE_URL)

const png = (seed: number) =>
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, seed])

describe.runIf(hasDatabase)("syncStockPresenters", () => {
  let db: typeof import("@/shared/db").db
  let syncStockPresenters: typeof import("../service").syncStockPresenters
  let dir: string
  const run = randomUUID().slice(0, 8)
  const catalog: StockPresenter[] = [
    { slug: `t-${run}-ada`, name: "Ada", voiceId: "af_heart", tags: ["Warm"] },
    { slug: `t-${run}-bo`, name: "Bo", voiceId: "am_puck", tags: ["Upbeat"] },
  ]
  const synthesize = vi.fn()
  const voice = { listVoices: () => [], synthesize }

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    ;({ syncStockPresenters } = await import("../service"))
    dir = await mkdtemp(join(tmpdir(), "reelpilot-presenters-"))
    await writeFile(join(dir, `${catalog[0]?.slug}.png`), png(1))
    await writeFile(join(dir, `${catalog[1]?.slug}.jpg`), png(2))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    putFile.mockResolvedValue(undefined)
    deleteFile.mockResolvedValue(undefined)
    synthesize.mockImplementation(async ({ key }: { key: string }) => ({
      audioKey: key,
      durationMs: 6200,
      costUsd: 0,
    }))
  })

  afterAll(async () => {
    await db.presenter.deleteMany({
      where: { slug: { startsWith: `t-${run}` } },
    })
    await rm(dir, { recursive: true, force: true })
  })

  const sync = (entries = catalog) =>
    syncStockPresenters({
      portraitsDir: dir,
      voice,
      catalog: entries,
      hideMissing: false,
    })

  it("creates presenters with portraits and voice samples", async () => {
    const report = await sync()

    expect(report).toMatchObject({
      presenters: 2,
      portraitsUploaded: 2,
      samplesMade: 2,
    })
    const ada = await db.presenter.findUniqueOrThrow({
      where: { slug: catalog[0]?.slug },
    })
    expect(ada).toMatchObject({
      name: "Ada",
      voiceId: "af_heart",
      tags: ["Warm"],
      sortOrder: 0,
      isActive: true,
      sampleDurationMs: 6200,
      portraitKey: expect.stringMatching(
        new RegExp(
          `^shared/presenters/${catalog[0]?.slug}/portrait-[0-9a-f]{12}\\.png$`
        )
      ),
      sampleKey: expect.stringMatching(/\/sample-af_heart-[0-9a-f]{12}\.m4a$/),
    })
    expect(putFile).toHaveBeenCalledWith(
      ada.portraitKey,
      expect.any(Buffer),
      "image/png"
    )
    // The .jpg portrait is stored as JPEG.
    expect(putFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.jpg$/),
      expect.any(Buffer),
      "image/jpeg"
    )
  })

  it("does nothing when nothing changed", async () => {
    await sync()
    vi.clearAllMocks()

    expect(await sync()).toMatchObject({ portraitsUploaded: 0, samplesMade: 0 })
    expect(putFile).not.toHaveBeenCalled()
    expect(synthesize).not.toHaveBeenCalled()
  })

  it("re-speaks only the presenter whose voice changed, and removes the old sample", async () => {
    await sync()
    vi.clearAllMocks()
    const before = await db.presenter.findUniqueOrThrow({
      where: { slug: catalog[1]?.slug },
    })

    const [ada, bo] = catalog as [StockPresenter, StockPresenter]
    const report = await sync([ada, { ...bo, voiceId: "bm_george" }])

    expect(report).toMatchObject({ samplesMade: 1, portraitsUploaded: 0 })
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: "bm_george" })
    )
    expect(deleteFile).toHaveBeenCalledWith(before.sampleKey)
  })

  it("uploads a replaced portrait under a new key", async () => {
    await sync()
    vi.clearAllMocks()
    await writeFile(join(dir, `${catalog[0]?.slug}.png`), png(9))

    expect(await sync()).toMatchObject({ portraitsUploaded: 1, samplesMade: 0 })
  })

  it("fails clearly when a portrait file is missing", async () => {
    await expect(
      sync([
        {
          slug: `t-${run}-ghost`,
          name: "Ghost",
          voiceId: "af_heart",
          tags: [],
        },
      ])
    ).rejects.toThrow(/No portrait for/)
  })
})
