import "server-only"

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { db } from "@/shared/db"
import type { VoiceProvider } from "@/shared/providers"
import { deleteFile, putFile, sharedFileKey } from "@/shared/storage"

import { sampleLine, stockPresenters, type StockPresenter } from "./lib/catalog"

const portraitTypes = [
  { extension: "png", type: "image/png" },
  { extension: "jpg", type: "image/jpeg" },
  { extension: "jpeg", type: "image/jpeg" },
  { extension: "webp", type: "image/webp" },
] as const

const shortHash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12)

async function readPortrait(dir: string, slug: string) {
  for (const { extension, type } of portraitTypes) {
    const bytes = await readFile(join(dir, `${slug}.${extension}`)).catch(
      () => null
    )
    if (bytes) return { bytes, extension, type }
  }
  throw new Error(`No portrait for "${slug}" in ${dir}`)
}

export type SyncReport = {
  presenters: number
  portraitsUploaded: number
  samplesMade: number
  hidden: number
}

/**
 * Makes the database and bucket match the stock catalog (the seed runs
 * this). Idempotent: a portrait is uploaded again only when its file
 * changes, and a sample is spoken again only when the voice or the line
 * changes (both are in the key). Presenters removed from the catalog are
 * hidden, not deleted.
 */
export async function syncStockPresenters(options: {
  portraitsDir: string
  voice: VoiceProvider
  catalog?: StockPresenter[]
  /** Hide active presenters missing from the catalog (off in tests). */
  hideMissing?: boolean
  log?: (message: string) => void
}): Promise<SyncReport> {
  const catalog = options.catalog ?? stockPresenters
  const log = options.log ?? (() => {})
  const report: SyncReport = {
    presenters: catalog.length,
    portraitsUploaded: 0,
    samplesMade: 0,
    hidden: 0,
  }

  for (const [sortOrder, entry] of catalog.entries()) {
    const existing = await db.presenter.findUnique({
      where: { slug: entry.slug },
      select: { portraitKey: true, sampleKey: true, sampleDurationMs: true },
    })

    const portrait = await readPortrait(options.portraitsDir, entry.slug)
    const portraitKey = sharedFileKey(
      "presenters",
      entry.slug,
      `portrait-${shortHash(portrait.bytes)}.${portrait.extension}`
    )
    if (existing?.portraitKey !== portraitKey) {
      await putFile(portraitKey, portrait.bytes, portrait.type)
      report.portraitsUploaded++
      log(`  portrait  ${entry.slug}`)
    }

    const sampleKey = sharedFileKey(
      "presenters",
      entry.slug,
      `sample-${entry.voiceId}-${shortHash(sampleLine)}.m4a`
    )
    let sampleDurationMs = existing?.sampleDurationMs ?? null
    if (existing?.sampleKey !== sampleKey) {
      const spoken = await options.voice.synthesize({
        text: sampleLine,
        voiceId: entry.voiceId,
        key: sampleKey,
      })
      sampleDurationMs = spoken.durationMs
      report.samplesMade++
      log(`  sample    ${entry.slug} (${entry.voiceId})`)
    }

    const fields = {
      name: entry.name,
      voiceId: entry.voiceId,
      tags: entry.tags,
      portraitKey,
      sampleKey,
      sampleDurationMs,
      sortOrder,
      isActive: true,
    }
    await db.presenter.upsert({
      where: { slug: entry.slug },
      create: { slug: entry.slug, ...fields },
      update: fields,
    })

    // Old files are only removed once the row points at the new ones.
    for (const old of [existing?.portraitKey, existing?.sampleKey]) {
      if (old && old !== portraitKey && old !== sampleKey) {
        await deleteFile(old).catch(() => {})
      }
    }
  }

  if (options.hideMissing ?? true) {
    const { count } = await db.presenter.updateMany({
      where: { slug: { notIn: catalog.map((p) => p.slug) }, isActive: true },
      data: { isActive: false },
    })
    report.hidden = count
  }
  return report
}
