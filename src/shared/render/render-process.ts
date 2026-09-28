// Runs one render in its own Node process (see ./index.ts): Remotion's
// renderer needs React's client build, but the worker runs with the
// "react-server" condition. No "server-only" here for the same reason.
//
// Usage: node --import tsx render-process.ts <job.json>
// job.json: { props, outputPath }. Prints one JSON line per update:
// {"progress":0.42} … then {"durationMs":12345}.
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { bundle } from "@remotion/bundler"
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer"

const send = (message: object) =>
  process.stdout.write(`${JSON.stringify(message)}\n`)

async function main() {
  const job = JSON.parse(await readFile(process.argv[2]!, "utf8")) as {
    props: Record<string, unknown>
    outputPath: string
  }
  await ensureBrowser()
  // webpack's cache (node_modules/.cache) makes repeat bundles quick.
  const serveUrl = await bundle({
    entryPoint: resolve(process.cwd(), "src/remotion/index.ts"),
    // The app's "@/…" imports.
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          "@": resolve(process.cwd(), "src"),
        },
      },
    }),
  })
  // Loading the clips from storage can be slow; frames wait up to a minute.
  const timeoutInMilliseconds = 60_000
  const composition = await selectComposition({
    serveUrl,
    id: "Video",
    inputProps: job.props,
    timeoutInMilliseconds,
    logLevel: "warn",
  })
  let sent = -1
  await renderMedia({
    serveUrl,
    composition,
    inputProps: job.props,
    codec: "h264",
    // Standard (limited) range, which every player shows right; frames as
    // high-quality JPEGs (the default 80 softens small UI text).
    pixelFormat: "yuv420p",
    jpegQuality: 92,
    muted: true,
    outputLocation: job.outputPath,
    timeoutInMilliseconds,
    onProgress: ({ progress }) => {
      // Whole percents only.
      const percent = Math.floor(progress * 100)
      if (percent === sent) return
      sent = percent
      send({ progress })
    },
    licenseKey: process.env.REMOTION_LICENSE_KEY || null,
    logLevel: "warn",
  })
  send({
    durationMs: Math.round(
      (composition.durationInFrames / composition.fps) * 1000
    ),
  })
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error
    )
    process.exit(1)
  }
)
