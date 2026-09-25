import { randomUUID } from "node:crypto"

import { beforeAll, describe, expect, it } from "vitest"

// Talks to a real bucket: the linked Neon branch locally (NEON_BRANCH is
// written by `neon env pull`), or CI's local S3 server (STORAGE_TESTS).
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

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

  async function postUpload(
    upload: { url: string; fields: Record<string, string> },
    body: Uint8Array<ArrayBuffer>,
    type: string
  ) {
    const form = new FormData()
    for (const [name, value] of Object.entries(upload.fields)) {
      form.set(name, value)
    }
    form.set("file", new Blob([body], { type }))
    return fetch(upload.url, { method: "POST", body: form })
  }

  it("takes a signed browser upload and refuses one over the size limit", async () => {
    const folder = `workspaces/test/storage-check/${randomUUID()}/`
    const key = `${folder}clip.mp4`
    const upload = await storage.signedFileUpload(key, {
      maxBytes: 16,
      contentType: "video/mp4",
      expiresInSeconds: 60,
    })

    const tooBig = await postUpload(upload, new Uint8Array(17), "video/mp4")
    expect(tooBig.ok).toBe(false)
    expect(await storage.fileSize(key)).toBeNull()

    const ok = await postUpload(upload, new Uint8Array(16), "video/mp4")
    expect(ok.ok).toBe(true)
    expect(await storage.fileSize(key)).toBe(16)

    await storage.deleteFolder(folder)
    expect(await storage.fileSize(key)).toBeNull()
  })

  it("streams files between storage and disk", async () => {
    const { mkdtemp, readFile, rm, writeFile } =
      await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const dir = await mkdtemp(join(tmpdir(), "reelpilot-storage-"))
    const folder = `workspaces/test/storage-check/${randomUUID()}/`
    try {
      const source = join(dir, "in.bin")
      const bytes = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251)
      await writeFile(source, bytes)

      await storage.uploadFromFile(
        `${folder}file.bin`,
        source,
        "application/octet-stream"
      )
      const copy = join(dir, "out.bin")
      await storage.downloadToFile(`${folder}file.bin`, copy)

      expect(Buffer.compare(await readFile(copy), Buffer.from(bytes))).toBe(0)
    } finally {
      await storage.deleteFolder(folder)
      await rm(dir, { recursive: true, force: true })
    }
  })
})
