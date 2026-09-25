import "server-only"

import { execFile } from "node:child_process"

import ffprobeInstaller from "@ffprobe-installer/ffprobe"
import ffmpegPath from "ffmpeg-static"

/** Bundled binaries (npm), so nobody installs ffmpeg by hand. */
const binaries = {
  ffmpeg: ffmpegPath ?? "ffmpeg",
  ffprobe: ffprobeInstaller.path,
}

export class MediaToolError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = "MediaToolError"
  }
}

function run(
  tool: keyof typeof binaries,
  args: string[],
  options: { timeoutMs: number; signal?: AbortSignal }
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      binaries[tool],
      args,
      {
        timeout: options.timeoutMs,
        signal: options.signal,
        maxBuffer: 64 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          // Keep the tail: ffmpeg prints its banner first, the reason last.
          const tail = stderr.split("\n").slice(-15).join("\n")
          reject(
            new MediaToolError(`${tool} failed: ${error.message}`, tail, {
              cause: error,
            })
          )
        } else {
          resolve({ stdout, stderr })
        }
      }
    )
  })
}

/** Runs ffmpeg (always non-interactive, overwriting outputs). */
export function runFfmpeg(
  args: string[],
  options: { timeoutMs: number; signal?: AbortSignal }
) {
  return run("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], options)
}

export type VideoInfo = {
  durationMs: number
  width: number
  height: number
  codec: string
  hasAudio: boolean
}

type ProbeOutput = {
  format?: { duration?: string }
  streams?: {
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    duration?: string
    tags?: { rotate?: string }
    side_data_list?: { rotation?: number }[]
  }[]
}

/**
 * Reads a file's first video stream. Returns null when the file has no
 * video (not a video, or unreadable). Width/height account for rotation.
 */
export async function probeVideo(
  file: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<VideoInfo | null> {
  let output: ProbeOutput
  try {
    const { stdout } = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        file,
      ],
      { timeoutMs: options.timeoutMs ?? 30_000, signal: options.signal }
    )
    output = JSON.parse(stdout) as ProbeOutput
  } catch (error) {
    if (error instanceof MediaToolError) return null
    throw error
  }

  const video = output.streams?.find((s) => s.codec_type === "video")
  if (!video?.width || !video.height) return null

  const seconds = Number(output.format?.duration ?? video.duration)
  const rotation = Math.abs(
    Number(video.tags?.rotate ?? video.side_data_list?.[0]?.rotation ?? 0)
  )
  const sideways = rotation === 90 || rotation === 270
  return {
    durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0,
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
    codec: video.codec_name ?? "unknown",
    hasAudio: Boolean(output.streams?.some((s) => s.codec_type === "audio")),
  }
}
