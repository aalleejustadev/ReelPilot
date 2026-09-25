import { randomUUID } from "node:crypto"

import { redirect } from "next/navigation"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

// Only the signed-in user and Next's cache are replaced; validation,
// authorization and the database write are real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Needs a database; skipped when DATABASE_URL is unset. App modules are
// imported in beforeAll so a skipped suite never loads them (env
// validation would fail at collection time otherwise).
const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDatabase)("renameWorkspace action", () => {
  const id = `test-${randomUUID()}`
  let db: typeof import("@/shared/db").db
  let renameWorkspace: typeof import("../actions").renameWorkspace
  let revalidatePath: typeof import("next/cache").revalidatePath
  let user: { id: string; name: string; email: string }

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    ;({ renameWorkspace } = await import("../actions"))
    ;({ revalidatePath } = await import("next/cache"))
    user = await db.user.create({
      data: { id, name: "Ada Lovelace", email: `${id}@example.com` },
    })
  })

  beforeEach(() => {
    requireUser.mockResolvedValue({ user })
  })

  afterAll(async () => {
    await db.user.delete({ where: { id } })
  })

  function submit(name: string) {
    const formData = new FormData()
    formData.set("name", name)
    return renameWorkspace(null, formData)
  }

  it("renames the workspace and refreshes the app", async () => {
    const result = await submit("  Launch team ")

    expect(result).toEqual({ ok: true, data: { name: "Launch team" } })
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { personalOwnerId: id },
    })
    expect(workspace.name).toBe("Launch team")
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("returns field errors instead of throwing for invalid input", async () => {
    const result = await submit("   ")

    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Check the workspace name.",
        fieldErrors: { name: ["Enter a name for your workspace."] },
      },
    })
  })

  it("lets the sign-in redirect through when signed out", async () => {
    requireUser.mockImplementation(() => redirect("/sign-in"))

    await expect(submit("Anything")).rejects.toThrow("NEXT_REDIRECT")
  })
})
