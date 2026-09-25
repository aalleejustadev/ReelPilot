import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

// Needs a database; skipped when DATABASE_URL is unset.
const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDatabase)("consumeRateLimit", () => {
  let db: typeof import("@/shared/db").db
  let consumeRateLimit: typeof import("../index").consumeRateLimit
  const prefix = `test:${randomUUID()}`

  beforeAll(async () => {
    ;({ db } = await import("@/shared/db"))
    ;({ consumeRateLimit } = await import("../index"))
  })

  afterAll(async () => {
    await db.rateLimitBucket.deleteMany({
      where: { key: { startsWith: prefix } },
    })
  })

  const use = (key: string, windowSeconds = 3600) =>
    consumeRateLimit({ key, limit: 2, windowSeconds, message: "Slow down." })

  it("allows up to the limit, then refuses with the message", async () => {
    const key = `${prefix}:basic`

    await use(key)
    await use(key)
    await expect(use(key)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Slow down.",
    })
  })

  it("counts keys separately", async () => {
    await use(`${prefix}:a`)
    await use(`${prefix}:a`)

    await expect(use(`${prefix}:b`)).resolves.toBeUndefined()
  })

  it("never lets concurrent calls past the limit", async () => {
    const key = `${prefix}:race`

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => use(key))
    )

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2)
  })

  it("starts a new window once the old one has passed", async () => {
    const key = `${prefix}:window`
    await use(key)
    await use(key)
    await db.rateLimitBucket.update({
      where: { key },
      data: { windowStart: new Date(Date.now() - 2 * 3600 * 1000) },
    })

    await expect(use(key)).resolves.toBeUndefined()
  })
})
