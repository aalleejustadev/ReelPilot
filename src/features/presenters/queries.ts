import "server-only"

import { voiceById } from "@/shared/config/voices"
import { db } from "@/shared/db"
import { signedFileUrl } from "@/shared/storage"

/** Active stock presenters in display order, with signed media links. */
export async function listPresenters() {
  const presenters = await db.presenter.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      tags: true,
      voiceId: true,
      portraitKey: true,
      sampleKey: true,
      sampleDurationMs: true,
    },
  })
  const sign = (key: string | null) => (key ? signedFileUrl(key, 3600) : null)
  return Promise.all(
    presenters.map(async ({ portraitKey, sampleKey, ...presenter }) => {
      const voice = voiceById(presenter.voiceId)
      return {
        ...presenter,
        voiceLabel: voice
          ? `${voice.label} · ${voice.accent}`
          : presenter.voiceId,
        portraitUrl: await sign(portraitKey),
        sampleUrl: await sign(sampleKey),
      }
    })
  )
}

export type PresenterCard = Awaited<ReturnType<typeof listPresenters>>[number]
