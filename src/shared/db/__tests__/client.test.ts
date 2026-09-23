import { afterAll, describe, expect, it } from "vitest"

// Needs a real database; skipped in CI, where no DATABASE_URL is set.
describe.skipIf(!process.env.DATABASE_URL)("db client (Neon)", async () => {
  const { db } = await import("../client")

  afterAll(() => db.$disconnect())

  it("connects through the pooled URL", async () => {
    const rows = await db.$queryRaw<{ ok: number }[]>`select 1 as ok`

    expect(rows).toEqual([{ ok: 1 }])
  })

  it("can read every M0 table", async () => {
    const counts = await Promise.all([
      db.user.count(),
      db.session.count(),
      db.account.count(),
      db.verification.count(),
      db.workspace.count(),
      db.membership.count(),
    ])

    for (const count of counts) expect(count).toBeGreaterThanOrEqual(0)
  })
})
