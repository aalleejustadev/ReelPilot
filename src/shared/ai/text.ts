import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import {
  createProviderRegistry,
  generateText,
  Output,
  type LanguageModel,
} from "ai"
import type { z } from "zod"

import { env } from "@/shared/config/env"
import { AppError } from "@/shared/lib/errors"

let registry: ReturnType<typeof createRegistry> | undefined
function createRegistry() {
  // One entry per AI_TEXT_PROVIDER value; each reads its own key from env.
  return createProviderRegistry({
    anthropic: createAnthropic({ apiKey: env.ANTHROPIC_API_KEY }),
  })
}

/** The configured text model (AI_TEXT_PROVIDER + AI_TEXT_MODEL). */
export function textModel(): LanguageModel {
  registry ??= createRegistry()
  return registry.languageModel(`${env.AI_TEXT_PROVIDER}:${env.AI_TEXT_MODEL}`)
}

/**
 * Asks the text model for data matching `schema`. The SDK validates the
 * result against the schema; any provider or validation failure becomes a
 * user-safe PROVIDER_FAILED error.
 */
export async function generateStructured<T>(input: {
  schema: z.ZodType<T>
  system: string
  prompt: string
  /** For tests: overrides the configured model. */
  model?: LanguageModel
}): Promise<T> {
  try {
    const { output } = await generateText({
      model: input.model ?? textModel(),
      output: Output.object({ schema: input.schema }),
      system: input.system,
      prompt: input.prompt,
      maxRetries: 2,
    })
    return output
  } catch (error) {
    throw new AppError(
      "PROVIDER_FAILED",
      "Our AI couldn't finish that. Try again in a moment.",
      { cause: error }
    )
  }
}
