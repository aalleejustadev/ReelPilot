import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { voices } from "@/shared/config/voices"

// Real model + real storage: runs where a bucket exists. The first run
// downloads the model (~90 MB) into .cache/models (cached in CI).
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

describe.runIf(hasStorage)("Kokoro voice", () => {
  let voice: typeof import("../kokoro").kokoroVoice
  let storage: typeof import("@/shared/storage")
  let media: typeof import("@/shared/media")
  const folder = `workspaces/test/voice-check/${randomUUID()}/`
  let dir: string

  beforeAll(async () => {
    ;({ kokoroVoice: voice } = await import("../kokoro"))
    storage = await import("@/shared/storage")
    media = await import("@/shared/media")
    dir = await mkdtemp(join(tmpdir(), "reelpilot-voice-test-"))
  }, 300_000)

  afterAll(async () => {
    await storage.deleteFolder(folder)
    await rm(dir, { recursive: true, force: true })
  })

  it("lists only the curated voices", () => {
    expect(voice.listVoices().map((v) => v.id)).toEqual(voices.map((v) => v.id))
  })

  it("speaks a line into a stored AAC file with its length", async () => {
    const key = `${folder}line.m4a`
    const result = await voice.synthesize({
      text: "Get paid twice as fast.",
      voiceId: "af_heart",
      key,
    })

    expect(result).toMatchObject({ audioKey: key, costUsd: 0 })
    expect(result.durationMs).toBeGreaterThan(800)
    expect(result.durationMs).toBeLessThan(5000)

    const file = join(dir, "line.m4a")
    await storage.downloadToFile(key, file)
    const { stderr } = await media.runFfmpeg(["-i", file, "-f", "null", "-"], {
      timeoutMs: 20_000,
    })
    expect(stderr).toMatch(/Audio: aac/)
  }, 300_000)

  it("handles two requests at once, one after the other", async () => {
    const [a, b] = await Promise.all([
      voice.synthesize({
        text: "One.",
        voiceId: "bf_emma",
        key: `${folder}a.m4a`,
      }),
      voice.synthesize({
        text: "Two.",
        voiceId: "am_puck",
        key: `${folder}b.m4a`,
      }),
    ])
    expect(a.durationMs).toBeGreaterThan(0)
    expect(b.durationMs).toBeGreaterThan(0)
  }, 300_000)
})
