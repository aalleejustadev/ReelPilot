import { randomUUID } from "node:crypto"

import { redirect } from "next/navigation"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// Only the signed-in user and Next's cache are replaced; validation,
// authorization and the database write are real.
const requireUser = vi.fn()
vi.mock("@/features/auth", () => ({ requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Runs against the real database; skipped in CI, where no .env exists.
describe.skipIf(!process.env.DATABASE_URL)(
  "renameWorkspace action",
  async () => {
    const { db } = await import("@/shared/db")
    const { renameWorkspace } = await import("../actions")
    const { revalidatePath } = await import("next/cache")

    const id = `test-${randomUUID()}`
    const user = await db.user.create({
      data: { id, name: "Ada Lovelace", email: `${id}@example.com` },
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
  }
)
