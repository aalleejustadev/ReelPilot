"use client"

import type { VariantProps } from "class-variance-authority"
import Link, { useLinkStatus } from "next/link"
import { cloneElement } from "react"

import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/ui/button"
import { Spinner } from "@/shared/ui/spinner"

/**
 * A real link styled as a button, with a loading state while the next page
 * loads. Use for navigation; use <Button> for actions.
 *
 * Why not <Button render={<Link />}>: Base UI gives the rendered anchor
 * role="button", which misleads screen readers.
 */
export function LinkButton({
  href,
  variant,
  size,
  icon,
  iconPosition = "start",
  className,
  children,
}: {
  href: string
  /** An icon element, e.g. <ArrowRightIcon />. Elements (not components)
   *  so server components can pass them. */
  icon?: React.ReactElement<{ "data-icon"?: string }>
  iconPosition?: "start" | "end"
  className?: string
  children: React.ReactNode
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {iconPosition === "start" && <PendingIcon icon={icon} position="start" />}
      {children}
      {iconPosition === "end" && <PendingIcon icon={icon} position="end" />}
    </Link>
  )
}

// Must render inside <Link>: useLinkStatus reads the nearest parent link.
function PendingIcon({
  icon,
  position,
}: {
  icon?: React.ReactElement<{ "data-icon"?: string }>
  position: "start" | "end"
}) {
  const { pending } = useLinkStatus()
  const slot = position === "start" ? "inline-start" : "inline-end"

  if (pending) return <Spinner data-icon={slot} />
  return icon ? cloneElement(icon, { "data-icon": slot }) : null
}
