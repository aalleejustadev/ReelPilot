import { afterAll, beforeAll, describe, expect, it } from "vitest"

// Needs a database; skipped when DATABASE_URL is unset. App modules are
// imported in beforeAll so a skipped suite never loads them (env
// validation would fail at collection time otherwise).
const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDatabase)("db client", () => {
  let db: typeof import("../client").db

  beforeAll(async () => {
    ;({ db } = await import("../client"))
  })
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
