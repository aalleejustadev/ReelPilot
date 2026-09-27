import { getCurrentWorkspace } from "@/features/workspaces"
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/ui/button"

/**
 * Full-screen editors (the footage editor): no app sidebar or top bar, so
 * the stage and timeline get the whole window. getCurrentWorkspace() is the
 * same sign-in gate the app layout uses.
 */
export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await getCurrentWorkspace()
  return (
    <>
      {/* First tab stop: jumps past the editor's top bar (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className={cn(
          buttonVariants(),
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        )}
      >
        Skip to content
      </a>
      {children}
    </>
  )
}
