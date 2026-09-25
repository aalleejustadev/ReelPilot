import "server-only"

import { kokoroVoice } from "./voice/kokoro"
import type { VoiceProvider } from "./voice/types"

export type { VoiceProvider } from "./voice/types"

/** The configured voice provider (V1: Kokoro, self-hosted). */
export function voiceProvider(): VoiceProvider {
  return kokoroVoice
}
