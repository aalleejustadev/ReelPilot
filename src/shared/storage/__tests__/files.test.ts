import { randomUUID } from "node:crypto"

import { beforeAll, describe, expect, it } from "vitest"

// Talks to the real bucket on the linked Neon branch. NEON_BRANCH is written
// by `neon env pull` locally; CI has placeholder storage env and skips this.
const hasStorage = Boolean(process.env.NEON_BRANCH)

describe.runIf(hasStorage)("file storage (Neon)", () => {
  let storage: typeof import("../index")

  beforeAll(async () => {
    storage = await import("../index")
  })

  it("stores, signs, serves and deletes a file", async () => {
    const key = storage.workspaceFileKey(
      "test",
      "storage-check",
      `${randomUUID()}.txt`
    )
    await storage.putFile(key, new TextEncoder().encode("hello"), "text/plain")

    const url = await storage.signedFileUrl(key, 60)
    const response = await fetch(url)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/plain")
    expect(await response.text()).toBe("hello")

    await storage.deleteFile(key)
    expect((await fetch(await storage.signedFileUrl(key, 60))).status).toBe(404)
  })

  it("never serves a file without a signature", async () => {
    const key = storage.workspaceFileKey(
      "test",
      "storage-check",
      `${randomUUID()}.txt`
    )
    await storage.putFile(
      key,
      new TextEncoder().encode("private"),
      "text/plain"
    )
    try {
      const signed = new URL(await storage.signedFileUrl(key, 60))
      const unsigned = `${signed.origin}${signed.pathname}`
      expect((await fetch(unsigned)).ok).toBe(false)
    } finally {
      await storage.deleteFile(key)
    }
  })

  it("treats deleting a missing file as done", async () => {
    await expect(
      storage.deleteFile(storage.workspaceFileKey("test", "missing.txt"))
    ).resolves.toBeUndefined()
  })
})
