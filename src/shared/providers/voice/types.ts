import type { Voice, VoiceId } from "@/shared/config/voices"

/**
 * Text-to-speech behind one interface (build plan §10), so features never
 * import a vendor SDK. V1 has one implementation: Kokoro, self-hosted.
 */
export interface VoiceProvider {
  listVoices(): readonly Voice[]
  /**
   * Speaks `text` and stores the audio (AAC, .m4a) at `key` in the media
   * bucket. `costUsd` is 0 for self-hosted voices; kept for the cost monitor.
   */
  synthesize(input: {
    text: string
    voiceId: VoiceId
    key: string
  }): Promise<{ audioKey: string; durationMs: number; costUsd: number }>
}
