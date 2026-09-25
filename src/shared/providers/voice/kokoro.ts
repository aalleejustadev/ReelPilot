import "server-only"

import { mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { voices } from "@/shared/config/voices"
import { runFfmpeg } from "@/shared/media"
import { uploadFromFile } from "@/shared/storage"

import type { VoiceProvider } from "./types"

/**
 * Kokoro-82M (Apache-2.0) through kokoro-js, on the CPU. The "q8" build is
 * ~90 MB, downloaded from Hugging Face on first use (no account) into
 * `.cache/models`, then loaded once per process.
 */
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"
export const modelCacheDir = join(process.cwd(), ".cache", "models")

type Tts = Awaited<
  ReturnType<typeof import("kokoro-js").KokoroTTS.from_pretrained>
>

let model: Promise<Tts> | undefined
function loadModel() {
  model ??= (async () => {
    const [{ env }, { KokoroTTS }] = await Promise.all([
      import("@huggingface/transformers"),
      import("kokoro-js"),
    ])
    env.cacheDir = modelCacheDir
    return KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" })
  })().catch((error: unknown) => {
    model = undefined // let the next call retry the download
    throw error
  })
  return model
}

/**
 * kokoro-js finds its voice files at `${__dirname}/../voices`, preferring a
 * global `__dirname` when one exists, and Prisma's generated client sets
 * one (pointing at src/shared/db/generated). While a voice loads, point the
 * global at kokoro-js's own folder. Safe: syntheses run one at a time, and
 * Prisma only reads its value when it first loads.
 */
const kokoroDist = dirname(createRequire(import.meta.url).resolve("kokoro-js"))
async function withKokoroDirname<T>(task: () => Promise<T>) {
  const scope = globalThis as { __dirname?: string }
  const previous = scope.__dirname
  scope.__dirname = kokoroDist
  try {
    return await task()
  } finally {
    if (previous === undefined) delete scope.__dirname
    else scope.__dirname = previous
  }
}

// One synthesis at a time: the model already uses every CPU core.
let queue: Promise<unknown> = Promise.resolve()
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

export const kokoroVoice: VoiceProvider = {
  listVoices: () => voices,

  synthesize: ({ text, voiceId, key }) =>
    oneAtATime(async () => {
      const tts = await loadModel()
      const audio = await withKokoroDirname(() =>
        tts.generate(text, { voice: voiceId })
      )
      const dir = await mkdtemp(join(tmpdir(), "reelpilot-voice-"))
      try {
        const wav = join(dir, "speech.wav")
        const m4a = join(dir, "speech.m4a")
        await audio.save(wav)
        // AAC is ~10× smaller than WAV and plays in every browser.
        await runFfmpeg(
          [
            "-i",
            wav,
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-movflags",
            "+faststart",
            m4a,
          ],
          { timeoutMs: 60_000 }
        )
        // Exact, from the samples (AAC adds a few ms of padding).
        const durationMs = Math.round(
          (audio.audio.length / audio.sampling_rate) * 1000
        )
        await uploadFromFile(key, m4a, "audio/mp4")
        return { audioKey: key, durationMs, costUsd: 0 }
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    }),
}
