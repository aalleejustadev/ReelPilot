import "server-only"

import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"

import type { RenderProps } from "@/remotion/Root"

// Remotion (§4): the compositions in src/remotion rendered to MP4 in
// headless Chrome, with the ffmpeg Remotion ships. Each render runs in its
// own process (./render-process.ts): the renderer can't load under the
// worker's "react-server" condition, and Chrome's memory goes with it.

export class RenderError extends Error {}

/**
 * Renders `props` to an H.264 MP4 at `outputPath` (no audio track: the
 * editor has no audio). `onProgress` gets 0–1; aborting `signal` stops it.
 */
export async function renderVideo(input: {
  props: RenderProps
  outputPath: string
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}): Promise<{ durationMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "reelpilot-render-"))
  try {
    const jobFile = join(dir, "job.json")
    await writeFile(
      jobFile,
      JSON.stringify({ props: input.props, outputPath: input.outputPath })
    )
    return await new Promise((done, fail) => {
      const child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          resolve(process.cwd(), "src/shared/render/render-process.ts"),
          jobFile,
        ],
        { stdio: ["ignore", "pipe", "pipe"], signal: input.signal }
      )
      let result: { durationMs: number } | null = null
      createInterface({ input: child.stdout }).on("line", (line) => {
        let message: { progress?: number; durationMs?: number }
        try {
          message = JSON.parse(line) as typeof message
        } catch {
          return // Remotion's own logging
        }
        if (typeof message.progress === "number") {
          input.onProgress?.(message.progress)
        }
        if (typeof message.durationMs === "number") {
          result = { durationMs: message.durationMs }
        }
      })
      // The last of stderr explains a failure.
      let stderr = ""
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-4000)
      })
      child.on("error", fail)
      child.on("close", (code) => {
        if (code === 0 && result) done(result)
        else fail(new RenderError(`Render failed (exit ${code}): ${stderr}`))
      })
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
