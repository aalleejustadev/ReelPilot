import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { brandKitFieldsSchema, type BrandKitFields } from "../schema"

// Needs a database; skipped when DATABASE_URL is unset. App modules are
// imported in beforeAll so a skipped suite never loads them.
const hasDatabase = Boolean(process.env.DATABASE_URL)

const fields = (overrides: Partial<BrandKitFields> = {}): BrandKitFields => ({
  ...brandKitFieldsSchema.parse({
    name: "ReelPilot",
    url: "reelpilot.app",
    description: "Video ads from real product footage.",
    audience: "SaaS founders",
    features: ["Script matrix"],
    pricingSummary: null,
    claims: [
      { text: "Ads in minutes" },
      { text: "Rollover credits", sourceUrl: "https://reelpilot.app/pricing" },
    ],
    bannedWords: [],
    colors: { primary: "#18b26b" },
    fonts: {},
    tone: null,
  }),
  ...overrides,
})

describe.runIf(hasDatabase)("brand kits service", () => {
  let db: typeof import("@/shared/db").db
  let service: typeof import("../service")
  let queries: typeof import("../queries")

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    service = await import("../service")
    queries = await import("../queries")
  })

  const workspaceIds: string[] = []

  async function createWorkspace() {
    const workspace = await db.workspace.create({
      data: { name: "Test workspace" },
    })
    workspaceIds.push(workspace.id)
    return workspace.id
  }

  afterEach(async () => {
    // Kits and claims cascade with the workspace.
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } })
    workspaceIds.length = 0
  })

  it("creates a kit with its claims in order", async () => {
    const workspaceId = await createWorkspace()

    const { id } = await service.createBrandKit(workspaceId, fields())
    const kit = await queries.getBrandKit(workspaceId, id)

    expect(kit).toMatchObject({
      name: "ReelPilot",
      url: "https://reelpilot.app/",
      colors: { primary: "#18b26b" },
      fonts: {},
      claims: [
        { text: "Ads in minutes", sourceUrl: null },
        {
          text: "Rollover credits",
          sourceUrl: "https://reelpilot.app/pricing",
        },
      ],
    })
  })

  it("holds any number of kits (free for now)", async () => {
    const workspaceId = await createWorkspace()

    await Promise.all(
      ["One", "Two", "Three", "Four"].map((name) =>
        service.createBrandKit(workspaceId, fields({ name }))
      )
    )

    const kits = await queries.listBrandKits(workspaceId)
    expect(kits.map((kit) => kit.name).sort()).toEqual([
      "Four",
      "One",
      "Three",
      "Two",
    ])
  })

  it("updates every field and replaces claims in the new order", async () => {
    const workspaceId = await createWorkspace()
    const { id } = await service.createBrandKit(workspaceId, fields())

    await service.updateBrandKit(
      workspaceId,
      id,
      fields({
        name: "Renamed",
        tone: "Friendly",
        claims: [
          { text: "Rollover credits", sourceUrl: null },
          { text: "New claim", sourceUrl: null },
        ],
      })
    )

    const kit = await queries.getBrandKit(workspaceId, id)
    expect(kit?.name).toBe("Renamed")
    expect(kit?.tone).toBe("Friendly")
    expect(kit?.claims.map((c) => c.text)).toEqual([
      "Rollover credits",
      "New claim",
    ])
  })

  it("never reads or changes another workspace's kit", async () => {
    const owner = await createWorkspace()
    const other = await createWorkspace()
    const { id } = await service.createBrandKit(owner, fields())

    expect(await queries.getBrandKit(other, id)).toBeNull()
    expect(await queries.listBrandKits(other)).toEqual([])
    await expect(
      service.updateBrandKit(other, id, fields({ name: "Hijacked" }))
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      service.setBrandKitLogo(other, id, null)
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(service.deleteBrandKit(other, id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect((await queries.getBrandKit(owner, id))?.name).toBe("ReelPilot")
  })

  it("swaps the logo and returns the previous key", async () => {
    const workspaceId = await createWorkspace()
    const { id } = await service.createBrandKit(workspaceId, fields())
    const first = `workspaces/${workspaceId}/brand-kits/${id}/logo-1.png`
    const second = `workspaces/${workspaceId}/brand-kits/${id}/logo-2.png`

    expect(await service.setBrandKitLogo(workspaceId, id, first)).toEqual({
      previousLogoKey: null,
    })
    expect(await service.setBrandKitLogo(workspaceId, id, second)).toEqual({
      previousLogoKey: first,
    })
    expect((await queries.getBrandKit(workspaceId, id))?.logoKey).toBe(second)
  })

  it("refuses a logo key from another workspace", async () => {
    const workspaceId = await createWorkspace()
    const { id } = await service.createBrandKit(workspaceId, fields())

    await expect(
      service.setBrandKitLogo(workspaceId, id, "workspaces/other/logo.png")
    ).rejects.toThrow(/outside the workspace/)
  })

  it("deletes the kit with its claims", async () => {
    const workspaceId = await createWorkspace()
    const { id } = await service.createBrandKit(workspaceId, fields())
    const logoKey = `workspaces/${workspaceId}/brand-kits/${id}/logo.png`
    await service.setBrandKitLogo(workspaceId, id, logoKey)

    expect(await service.deleteBrandKit(workspaceId, id)).toEqual({ logoKey })
    expect(await db.allowedClaim.count({ where: { brandKitId: id } })).toBe(0)
  })
})
