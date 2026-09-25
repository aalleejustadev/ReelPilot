import { randomUUID } from "node:crypto"

import { afterEach, describe, expect, it } from "vitest"

// Runs against the real database; skipped in CI, where no .env exists.
describe.skipIf(!process.env.DATABASE_URL)("personal workspaces", async () => {
  const { db } = await import("@/shared/db")
  const { ensurePersonalWorkspace, renameWorkspace } =
    await import("../service")

  const userIds: string[] = []

  async function createUser(name = "Ada Lovelace") {
    const id = `test-${randomUUID()}`
    userIds.push(id)
    return db.user.create({
      data: { id, name, email: `${id}@example.com` },
    })
  }

  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: userIds } } })
    userIds.length = 0
  })

  it("creates the workspace on first use with the user as owner", async () => {
    const user = await createUser()

    const { workspace, role } = await ensurePersonalWorkspace(user)

    expect(workspace.name).toBe("Ada’s workspace")
    expect(workspace.plan).toBe("FREE")
    expect(workspace.personalOwnerId).toBe(user.id)
    expect(role).toBe("OWNER")
  })

  it("returns the same workspace on later calls", async () => {
    const user = await createUser()

    const first = await ensurePersonalWorkspace(user)
    const second = await ensurePersonalWorkspace(user)

    expect(second.workspace.id).toBe(first.workspace.id)
  })

  it("creates exactly one workspace under concurrent first requests", async () => {
    const user = await createUser()

    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensurePersonalWorkspace(user))
    )

    expect(new Set(results.map((r) => r.workspace.id)).size).toBe(1)
    expect(
      await db.workspace.count({ where: { personalOwnerId: user.id } })
    ).toBe(1)
    expect(await db.membership.count({ where: { userId: user.id } })).toBe(1)
  })

  it("deletes the personal workspace when the user is deleted", async () => {
    const user = await createUser()
    const { workspace } = await ensurePersonalWorkspace(user)

    await db.user.delete({ where: { id: user.id } })

    expect(
      await db.workspace.findUnique({ where: { id: workspace.id } })
    ).toBeNull()
  })

  it("renames a workspace", async () => {
    const user = await createUser()
    const { workspace } = await ensurePersonalWorkspace(user)

    const renamed = await renameWorkspace(workspace.id, "Launch team")

    expect(renamed.name).toBe("Launch team")
  })
})
