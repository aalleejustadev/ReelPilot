import { z } from "zod"

export const workspaceNameMaxLength = 50

export const renameWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for your workspace.")
    .max(
      workspaceNameMaxLength,
      `Keep the name under ${workspaceNameMaxLength} characters.`
    ),
})

export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceSchema>
