import type { VoiceId } from "@/shared/config/voices"

/** The line every presenter's sample says (short, sounds like an ad). */
export const sampleLine =
  "Stop losing hours to busywork. Our app does it for you, so you can focus on what matters. Try it free today."

export type StockPresenter = {
  slug: string
  name: string
  voiceId: VoiceId
  tags: string[]
}

/**
 * The stock library (owner decision 2026-09-25): 4 women and 4 men,
 * American and British, on Kokoro's best voices. Portraits live in
 * prisma/seed-assets/presenters/<slug>.png. Order = display order.
 */
export const stockPresenters: StockPresenter[] = [
  {
    slug: "maya",
    name: "Maya",
    voiceId: "af_heart",
    tags: ["Warm", "American"],
  },
  {
    slug: "marcus",
    name: "Marcus",
    voiceId: "am_michael",
    tags: ["Steady", "American"],
  },
  {
    slug: "emma",
    name: "Emma",
    voiceId: "bf_emma",
    tags: ["Clear", "British"],
  },
  {
    slug: "diego",
    name: "Diego",
    voiceId: "am_fenrir",
    tags: ["Bold", "American"],
  },
  {
    slug: "chloe",
    name: "Chloe",
    voiceId: "af_bella",
    tags: ["Energetic", "American"],
  },
  {
    slug: "oliver",
    name: "Oliver",
    voiceId: "bm_george",
    tags: ["Assured", "British"],
  },
  {
    slug: "priya",
    name: "Priya",
    voiceId: "af_nicole",
    tags: ["Calm", "American"],
  },
  {
    slug: "sam",
    name: "Sam",
    voiceId: "am_puck",
    tags: ["Upbeat", "American"],
  },
]
