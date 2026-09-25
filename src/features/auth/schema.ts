import { z } from "zod"

export const profileNameMaxLength = 60

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(
      profileNameMaxLength,
      `Keep your name under ${profileNameMaxLength} characters.`
    ),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
