import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { probeVideo, runFfmpeg } from "../ffmpeg"

describe("ffmpeg helpers (bundled binaries)", () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "reelpilot-media-"))
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("generates a video with ffmpeg and reads it with ffprobe", async () => {
    const file = join(dir, "test.mp4")
    await runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=2:size=320x240:rate=30",
        "-f",
        "lavfi",
        "-i",
        "sine=duration=2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        file,
      ],
      { timeoutMs: 30_000 }
    )

    const info = await probeVideo(file)

    expect(info).toMatchObject({
      width: 320,
      height: 240,
      codec: "h264",
      hasAudio: true,
    })
    expect(info?.durationMs).toBeGreaterThan(1900)
    expect(info?.durationMs).toBeLessThan(2200)
  })

  it("returns null for a file that isn't a video", async () => {
    const file = join(dir, "fake.mp4")
    await writeFile(file, "<svg onload=alert(1)>")

    expect(await probeVideo(file)).toBeNull()
  })

  it("reports ffmpeg failures with the tail of its output", async () => {
    await expect(
      runFfmpeg(["-i", join(dir, "missing.mp4"), join(dir, "out.mp4")], {
        timeoutMs: 10_000,
      })
    ).rejects.toMatchObject({
      name: "MediaToolError",
      stderr: expect.stringContaining("No such file"),
    })
  })
})
