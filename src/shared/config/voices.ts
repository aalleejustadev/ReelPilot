/**
 * Stock voices (Kokoro, build plan §4): only the model's best-rated
 * English voices. Presenters pick a default; campaigns may pair any
 * presenter with any voice (M4/M5).
 */
export const voices = [
  {
    id: "af_heart",
    label: "Heart",
    accent: "American",
    gender: "female",
    style: "Warm",
  },
  {
    id: "af_bella",
    label: "Bella",
    accent: "American",
    gender: "female",
    style: "Energetic",
  },
  {
    id: "af_nicole",
    label: "Nicole",
    accent: "American",
    gender: "female",
    style: "Calm",
  },
  {
    id: "bf_emma",
    label: "Emma",
    accent: "British",
    gender: "female",
    style: "Clear",
  },
  {
    id: "am_michael",
    label: "Michael",
    accent: "American",
    gender: "male",
    style: "Steady",
  },
  {
    id: "am_fenrir",
    label: "Fenrir",
    accent: "American",
    gender: "male",
    style: "Bold",
  },
  {
    id: "am_puck",
    label: "Puck",
    accent: "American",
    gender: "male",
    style: "Upbeat",
  },
  {
    id: "bm_george",
    label: "George",
    accent: "British",
    gender: "male",
    style: "Assured",
  },
] as const

export type VoiceId = (typeof voices)[number]["id"]
export type Voice = (typeof voices)[number]

export function voiceById(id: string): Voice | undefined {
  return voices.find((voice) => voice.id === id)
}
