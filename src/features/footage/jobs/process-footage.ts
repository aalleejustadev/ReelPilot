import "server-only"

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { enqueue } from "@/shared/jobs"
import { MediaToolError, probeVideo, runFfmpeg } from "@/shared/media"
import { downloadToFile, uploadFromFile } from "@/shared/storage"

import { footageLimitsFor, tooLongMessage } from "../lib/limits"
import {
  parseSceneLog,
  pickAutoMarkers,
  posterArgs,
  sceneDetectArgs,
  thumbnailPlan,
  thumbnailStripArgs,
  transcodeArgs,
} from "../lib/processing"
import {
  failFootage,
  getFootageForProcessing,
  saveProcessedFootage,
} from "../service"
import { analyzeFootageJob } from "./definitions"

/** A problem with the file itself: retrying won't help, tell the user. */
class UnusableFootage extends Error {}

const messages = {
  notVideo:
    "We couldn’t read this file as a video. Upload an MP4, MOV or WebM file.",
  tooShort:
    "Your footage is shorter than a second. Record or upload a longer clip.",
  convertFailed:
    "We couldn’t convert this video. Try exporting it again as MP4 (H.264) and upload that.",
  retriesExhausted:
    "We couldn’t process this clip. Try uploading it again in a few minutes.",
}

const minutes = (n: number) => n * 60 * 1000

/**
 * Converts one uploaded clip: checks it, makes a web-friendly MP4 (no
 * audio), a poster, a thumbnail strip and auto markers, then marks it READY.
 * File problems fail the clip at once; anything else (storage, network)
 * throws so the queue retries, and the last attempt records the failure.
 */
export async function processFootage(
  { footageId }: { footageId: string },
  { signal, isLastAttempt }: { signal: AbortSignal; isLastAttempt: boolean }
) {
  const clip = await getFootageForProcessing(footageId)
  // Deleted, or already done by an earlier attempt: nothing to do.
  if (!clip || clip.status !== "PROCESSING") return

  const dir = await mkdtemp(join(tmpdir(), `reelpilot-footage-${footageId}-`))
  try {
    const original = join(dir, "original")
    await downloadToFile(clip.originalKey, original)

    const info = await probeVideo(original, { signal })
    if (!info) throw new UnusableFootage(messages.notVideo)
    const { maxDurationSeconds } = footageLimitsFor(clip.workspace.plan)
    // A second of slack for container rounding.
    const isTooLong = (ms: number) => ms > maxDurationSeconds * 1000 + 1000
    // Browser recordings (MediaRecorder WebM) often carry no duration, so
    // the length is checked again on the converted file below.
    if (isTooLong(info.durationMs)) {
      throw new UnusableFootage(tooLongMessage(clip.workspace.plan))
    }

    const video = join(dir, "video.mp4")
    await convert(transcodeArgs(original, video), minutes(25), signal)
    const converted = await probeVideo(video, { signal })
    if (!converted) throw new UnusableFootage(messages.convertFailed)
    if (isTooLong(converted.durationMs)) {
      throw new UnusableFootage(tooLongMessage(clip.workspace.plan))
    }
    if (converted.durationMs < 1000) {
      throw new UnusableFootage(messages.tooShort)
    }

    const poster = join(dir, "poster.jpg")
    const strip = join(dir, "thumbnails.jpg")
    const plan = thumbnailPlan(converted.durationMs)
    await convert(
      posterArgs(video, poster, converted.durationMs),
      minutes(2),
      signal
    )
    await convert(thumbnailStripArgs(video, strip, plan), minutes(5), signal)
    const { stderr } = await runFfmpeg(sceneDetectArgs(video), {
      timeoutMs: minutes(10),
      signal,
    })
    const autoMarkersMs = pickAutoMarkers(
      parseSceneLog(stderr),
      converted.durationMs
    )

    const folder = clip.originalKey.slice(
      0,
      clip.originalKey.lastIndexOf("/") + 1
    )
    await uploadFromFile(`${folder}video.mp4`, video, "video/mp4")
    await uploadFromFile(`${folder}poster.jpg`, poster, "image/jpeg")
    await uploadFromFile(`${folder}thumbnails.jpg`, strip, "image/jpeg")

    await saveProcessedFootage(footageId, {
      durationMs: converted.durationMs,
      width: converted.width,
      height: converted.height,
      thumbnailCount: plan.count,
      thumbnailIntervalMs: plan.intervalMs,
      autoMarkersMs,
    })
    // The smart analysis runs as its own job, so its trouble never fails
    // the clip. A lost enqueue is picked up by the stuck-analysis sweep.
    await enqueue(
      analyzeFootageJob,
      { footageId },
      { singletonKey: footageId }
    ).catch((error: unknown) =>
      console.warn(`[footage] couldn't queue analysis for ${footageId}`, error)
    )
  } catch (error) {
    if (error instanceof UnusableFootage) {
      await failFootage(footageId, error.message)
      return
    }
    if (isLastAttempt) await failFootage(footageId, messages.retriesExhausted)
    throw error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** ffmpeg failing on a file ffprobe accepted means the file is the problem. */
async function convert(args: string[], timeoutMs: number, signal: AbortSignal) {
  try {
    await runFfmpeg(args, { timeoutMs, signal })
  } catch (error) {
    if (error instanceof MediaToolError && !signal.aborted) {
      console.warn("ffmpeg failed", error.stderr)
      throw new UnusableFootage(messages.convertFailed)
    }
    throw error
  }
}
