import "server-only"

import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { env } from "@/shared/config/env"
import { aiLimits } from "@/shared/config/plans"
import type { LanguageModel } from "@/shared/ai"
import { AppError } from "@/shared/lib/errors"
import { runFfmpeg } from "@/shared/media"
import { consumeRateLimit } from "@/shared/rate-limit"
import { downloadToFile } from "@/shared/storage"

import {
  analysisRules,
  diffFrames,
  gridFor,
  paletteFrom,
  parseStoredAnalysis,
  sampleEveryMs,
  summarizeActivity,
  type FootageAnalysis,
} from "../lib/analysis"
import { describeMoment } from "../lib/describe-moment"
import { parseStoredInsight } from "../lib/insight"
import { analysisFramesArgs, momentFrameArgs } from "../lib/processing"
import {
  getFootageForAnalysis,
  saveFootageAnalysis,
  saveMomentInsight,
  setAnalysisStatus,
} from "../service"

const minutes = (n: number) => n * 60 * 1000

/** At most this many moments are described per run (the rest next run). */
const maxDescribedPerRun = 20

/**
 * Analyses a READY clip: the activity map (once), then describes every
 * moment without a description. A failed description is skipped (the
 * moment keeps working without one); storage or ffmpeg trouble throws so
 * the queue retries, and the last attempt marks the analysis FAILED.
 */
export async function analyzeFootage(
  { footageId }: { footageId: string },
  {
    signal,
    isLastAttempt,
    model,
  }: { signal: AbortSignal; isLastAttempt: boolean; model?: LanguageModel }
) {
  const clip = await getFootageForAnalysis(footageId)
  if (
    !clip ||
    clip.status !== "READY" ||
    !clip.videoKey ||
    !clip.durationMs ||
    !clip.width ||
    !clip.height
  ) {
    return
  }
  await setAnalysisStatus(footageId, "RUNNING")

  const dir = await mkdtemp(join(tmpdir(), `reelpilot-analysis-${footageId}-`))
  try {
    const video = join(dir, "video.mp4")
    await downloadToFile(clip.videoKey, video)

    if (!parseStoredAnalysis(clip.analysis)) {
      const analysis = await analyzeVideo(
        video,
        { durationMs: clip.durationMs, width: clip.width, height: clip.height },
        dir,
        signal
      )
      await saveFootageAnalysis(footageId, analysis)
    }

    if (env.AI_VISION === "on" || model) {
      // momentFrameArgs: at most 1280 wide, same shape, even height.
      const width = Math.min(1280, clip.width)
      const frameSize = {
        width,
        height: Math.round((width * clip.height) / clip.width / 2) * 2,
      }
      const pending = clip.markers
        .filter((marker) => !parseStoredInsight(marker.insight))
        .slice(0, maxDescribedPerRun)
      for (const marker of pending) {
        if (signal.aborted) break
        try {
          await consumeRateLimit({
            key: `footage-vision:${clip.workspaceId}`,
            limit: aiLimits.momentDescriptionsPerDay,
            windowSeconds: 24 * 60 * 60,
            message: "Daily limit for describing key moments reached.",
          })
        } catch (error) {
          if (error instanceof AppError && error.code === "RATE_LIMITED") break
          throw error
        }
        // Just after the moment: a cut or click has settled by then.
        const atMs = Math.min(clip.durationMs - 100, marker.atMs + 600)
        const frame = join(dir, `moment-${marker.id}.jpg`)
        await runFfmpeg(momentFrameArgs(video, frame, Math.max(0, atMs)), {
          timeoutMs: minutes(1),
          signal,
        })
        try {
          const insight = await describeMoment({
            frame: await readFile(frame),
            size: frameSize,
            brandName: clip.brandKit.name,
            model,
          })
          await saveMomentInsight(marker.id, marker.atMs, insight)
        } catch (error) {
          console.warn(
            `[analysis] couldn't describe marker ${marker.id}`,
            error
          )
        }
      }
    }

    await setAnalysisStatus(footageId, "READY")
  } catch (error) {
    if (isLastAttempt) await setAnalysisStatus(footageId, "FAILED")
    throw error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Decodes small frames with ffmpeg and runs the pure analysis on them. */
export async function analyzeVideo(
  video: string,
  clip: { durationMs: number; width: number; height: number },
  dir: string,
  signal: AbortSignal
): Promise<FootageAnalysis> {
  const grid = gridFor(clip.width, clip.height)
  const sampleMs = sampleEveryMs(clip.durationMs)
  const grayFile = join(dir, "frames.gray")
  await runFfmpeg(
    analysisFramesArgs(video, grayFile, {
      fps: `1000/${sampleMs}`,
      size: grid,
      pixels: "gray",
    }),
    { timeoutMs: minutes(10), signal }
  )
  const gray = await readFile(grayFile)
  const frameBytes = grid.w * grid.h
  const frameCount = Math.floor(gray.length / frameBytes)
  const frame = (i: number) =>
    gray.subarray(i * frameBytes, (i + 1) * frameBytes)
  const diffs = []
  for (let i = 1; i < frameCount; i++) {
    diffs.push(diffFrames(frame(i - 1), frame(i), grid))
  }

  // Colours from up to maxPaletteFrames small frames across the clip.
  const paletteSize = {
    w: analysisRules.paletteWidth,
    h: Math.max(
      2,
      Math.round((analysisRules.paletteWidth * clip.height) / clip.width / 2) *
        2
    ),
  }
  const seconds = clip.durationMs / 1000
  const paletteFps = Math.min(1, analysisRules.maxPaletteFrames / seconds)
  const rgbFile = join(dir, "frames.rgb")
  await runFfmpeg(
    analysisFramesArgs(video, rgbFile, {
      fps: paletteFps.toFixed(4),
      size: paletteSize,
      pixels: "rgb24",
    }),
    { timeoutMs: minutes(5), signal }
  )
  const palette = paletteFrom(await readFile(rgbFile))

  return {
    version: 1,
    sampleMs,
    ...summarizeActivity(diffs, sampleMs),
    palette,
  }
}
