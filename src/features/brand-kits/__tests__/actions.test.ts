import { randomUUID } from "node:crypto"

import { redirect } from "next/navigation"
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

import { aiLimits } from "@/shared/config/limits"

import { brandKitFieldsSchema } from "../schema"

// Replaced: the signed-in user, Next's cache, the website/AI draft, the logo
// download and file storage. Validation, permissions, limits and database
// writes are real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const draftKitFromUrl = vi.fn()
vi.mock("../lib/draft-kit", () => ({ draftKitFromUrl }))

const fetchLogo = vi.fn()
vi.mock("../lib/logo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/logo")>()),
  fetchLogo,
}))

const putFile = vi.fn()
const deleteFile = vi.fn()
const deleteFolder = vi.fn()
vi.mock("@/shared/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/storage")>()),
  putFile,
  deleteFile,
  deleteFolder,
}))

const hasDatabase = Boolean(process.env.DATABASE_URL)

const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])

const draftFields = () =>
  brandKitFieldsSchema.parse({
    name: "Acme",
    url: "https://acme.app",
    description: "Invoices that chase themselves.",
    audience: "Freelancers",
    features: ["Reminders"],
    pricingSummary: null,
    claims: [{ text: "Get paid 2x faster", sourceUrl: "https://acme.app/" }],
    bannedWords: [],
    colors: { primary: "#ff5a1f" },
    fonts: {},
    tone: null,
  })

describe.runIf(hasDatabase)("brand kit actions", () => {
  const userId = `test-${randomUUID()}`
  let db: typeof import("@/shared/db").db
  let actions: typeof import("../actions")
  let workspaceId: string

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    actions = await import("../actions")
    const user = await db.user.create({
      data: {
        id: userId,
        name: "Ada Lovelace",
        email: `${userId}@example.com`,
      },
    })
    requireUser.mockResolvedValue({ user })
    const { getCurrentWorkspace } = await import("@/features/workspaces")
    ;({
      workspace: { id: workspaceId },
    } = await getCurrentWorkspace())
  })

  beforeEach(() => {
    const user = { id: userId, name: "Ada Lovelace" }
    requireUser.mockResolvedValue({ user })
    draftKitFromUrl.mockResolvedValue({
      fields: draftFields(),
      logoUrls: ["https://acme.app/logo.png"],
      isComplete: true,
    })
    fetchLogo.mockResolvedValue({ bytes: png, type: "image/png" })
    putFile.mockResolvedValue(undefined)
    deleteFile.mockResolvedValue(undefined)
    deleteFolder.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await db.brandKit.deleteMany({ where: { workspaceId } })
    await db.rateLimitBucket.deleteMany({
      where: { key: `brand-kit-draft:${workspaceId}` },
    })
    await db.membership.updateMany({
      where: { workspaceId },
      data: { role: "OWNER" },
    })
  })

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } })
  })

  const fromUrl = (url: string) => actions.createBrandKitFromUrl(url)

  async function createKit() {
    const result = await fromUrl("acme.app")
    if (!result.ok) throw new Error(result.error.message)
    return result.data.kitId
  }

  describe("createBrandKitFromUrl", () => {
    it("drafts the kit, stores the site's logo and refreshes the pages", async () => {
      const result = await fromUrl("acme.app")

      expect(result).toMatchObject({ ok: true, data: { isComplete: true } })
      expect(draftKitFromUrl).toHaveBeenCalledWith("https://acme.app/")
      const kit = await db.brandKit.findFirstOrThrow({ where: { workspaceId } })
      expect(kit.name).toBe("Acme")
      expect(kit.logoKey).toMatch(
        new RegExp(
          `^workspaces/${workspaceId}/brand-kits/${kit.id}/logo-.+\\.png$`
        )
      )
      expect(putFile).toHaveBeenCalledWith(kit.logoKey, png, "image/png")
      const { revalidatePath } = await import("next/cache")
      expect(revalidatePath).toHaveBeenCalledWith("/brand-kits", "layout")
    })

    it("still creates the kit when the logo can't be fetched", async () => {
      fetchLogo.mockResolvedValue(null)

      expect(await fromUrl("acme.app")).toMatchObject({ ok: true })
      const kit = await db.brandKit.findFirstOrThrow({ where: { workspaceId } })
      expect(kit.logoKey).toBeNull()
    })

    it("returns a field error for a bad address without calling the AI", async () => {
      const result = await fromUrl("localhost")

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "VALIDATION",
          fieldErrors: { url: [expect.any(String)] },
        },
      })
      expect(draftKitFromUrl).not.toHaveBeenCalled()
    })

    it("stops after the daily AI draft limit", async () => {
      await db.rateLimitBucket.create({
        data: {
          key: `brand-kit-draft:${workspaceId}`,
          count: aiLimits.brandKitDraftsPerDay,
          windowStart: new Date(),
        },
      })

      const result = await fromUrl("acme.app")

      expect(result).toMatchObject({
        ok: false,
        error: { code: "RATE_LIMITED" },
      })
      expect(draftKitFromUrl).not.toHaveBeenCalled()
    })

    it("passes on the site's error message", async () => {
      const { AppError } = await import("@/shared/lib/errors")
      draftKitFromUrl.mockRejectedValue(
        new AppError("VALIDATION", "We couldn’t reach acme.app.", {
          fieldErrors: { url: ["We couldn’t reach acme.app."] },
        })
      )

      expect(await fromUrl("acme.app")).toMatchObject({
        ok: false,
        error: { message: "We couldn’t reach acme.app." },
      })
    })

    it("refuses viewers", async () => {
      await db.membership.updateMany({
        where: { workspaceId },
        data: { role: "VIEWER" },
      })

      expect(await fromUrl("acme.app")).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      })
      expect(draftKitFromUrl).not.toHaveBeenCalled()
    })

    it("lets the sign-in redirect through when signed out", async () => {
      requireUser.mockImplementation(() => redirect("/sign-in"))

      await expect(fromUrl("acme.app")).rejects.toThrow("NEXT_REDIRECT")
    })
  })

  it("creates an empty kit without reading the site", async () => {
    const result = await actions.createBrandKitManually("www.acme.app/start")

    expect(result).toMatchObject({ ok: true })
    const kit = await db.brandKit.findFirstOrThrow({ where: { workspaceId } })
    expect(kit).toMatchObject({ name: "acme.app", description: "" })
    expect(draftKitFromUrl).not.toHaveBeenCalled()
  })

  describe("saveBrandKit", () => {
    it("saves the edited fields", async () => {
      const kitId = await createKit()

      const result = await actions.saveBrandKit({
        kitId,
        fields: { ...draftFields(), name: "Acme Invoices", tone: "Warm" },
      })

      expect(result).toEqual({ ok: true, data: { kitId } })
      const kit = await db.brandKit.findUniqueOrThrow({ where: { id: kitId } })
      expect(kit).toMatchObject({ name: "Acme Invoices", tone: "Warm" })
    })

    it("names the exact field that needs a fix", async () => {
      const kitId = await createKit()

      const result = await actions.saveBrandKit({
        kitId,
        fields: {
          ...draftFields(),
          name: "",
          claims: [{ text: "Fast", sourceUrl: "not a link" }],
        },
      })

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "VALIDATION",
          fieldErrors: {
            name: ["Give this brand kit a name."],
            "claims.0.sourceUrl": ["Use a full link starting with https://."],
          },
        },
      })
    })

    it("can't touch a kit in another workspace", async () => {
      const other = await db.workspace.create({ data: { name: "Other" } })
      const kit = await db.brandKit.create({
        data: { workspaceId: other.id, name: "Theirs", url: "https://x.app/" },
      })
      try {
        const result = await actions.saveBrandKit({
          kitId: kit.id,
          fields: draftFields(),
        })

        expect(result).toMatchObject({
          ok: false,
          error: { code: "NOT_FOUND" },
        })
      } finally {
        await db.workspace.delete({ where: { id: other.id } })
      }
    })
  })

  describe("logo upload", () => {
    const upload = (kitId: string, file: File) => {
      const formData = new FormData()
      formData.set("kitId", kitId)
      formData.set("logo", file)
      return actions.uploadBrandKitLogo(formData)
    }

    it("stores a real image under a new key and deletes the old one", async () => {
      const kitId = await createKit()
      const before = await db.brandKit.findUniqueOrThrow({
        where: { id: kitId },
      })

      const result = await upload(kitId, new File([png], "logo.png"))

      expect(result).toEqual({ ok: true, data: null })
      const after = await db.brandKit.findUniqueOrThrow({
        where: { id: kitId },
      })
      expect(after.logoKey).not.toBe(before.logoKey)
      expect(deleteFile).toHaveBeenCalledWith(before.logoKey)
    })

    it("rejects a script disguised as a PNG", async () => {
      const kitId = await createKit()
      putFile.mockClear()

      const result = await upload(
        kitId,
        new File(["<svg onload=alert(1)>"], "logo.png", { type: "image/png" })
      )

      expect(result).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", message: expect.stringContaining("PNG") },
      })
      expect(putFile).not.toHaveBeenCalled()
    })

    it("rejects files over 2 MB", async () => {
      const kitId = await createKit()
      const big = new Uint8Array(2 * 1024 * 1024 + 1)
      big.set(png)

      expect(await upload(kitId, new File([big], "logo.png"))).toMatchObject({
        ok: false,
        error: { message: expect.stringContaining("larger than 2 MB") },
      })
    })

    it("removes the logo and its file", async () => {
      const kitId = await createKit()
      const { logoKey } = await db.brandKit.findUniqueOrThrow({
        where: { id: kitId },
      })

      expect(await actions.removeBrandKitLogo(kitId)).toEqual({
        ok: true,
        data: null,
      })
      expect(deleteFile).toHaveBeenCalledWith(logoKey)
    })
  })

  it("deletes the kit and every file in its folder", async () => {
    const kitId = await createKit()

    expect(await actions.deleteBrandKit(kitId)).toEqual({
      ok: true,
      data: null,
    })
    expect(await db.brandKit.count({ where: { id: kitId } })).toBe(0)
    expect(deleteFolder).toHaveBeenCalledWith(
      `workspaces/${workspaceId}/brand-kits/${kitId}/`
    )
  })
})
