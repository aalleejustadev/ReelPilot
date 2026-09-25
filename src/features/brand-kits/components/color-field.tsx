"use client"

import { PipetteIcon, XIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"
import { Field, FieldError, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim())

/** True for light colours, which need a dark icon on top (WCAG luminance). */
function isLight(hex: string) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4
}

/**
 * Pick a colour with the system colour picker (the swatch), or paste an
 * exact hex value. Optional, so it can be cleared.
 */
export function ColorField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const hasColor = isHex(value)

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        {/* The native picker fills this box invisibly, so clicking the swatch
            opens it. It comes first so the swatch (a later "peer") can show
            its focus ring; the swatch ignores clicks. */}
        <div className="relative size-9 shrink-0">
          <input
            type="color"
            aria-label={`Pick ${label.toLowerCase()}`}
            value={hasColor ? value.toLowerCase() : "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border",
              "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
              // The eyedropper always shows, readable on any fill.
              !hasColor
                ? "border-dashed text-muted-foreground"
                : isLight(value)
                  ? "text-foreground"
                  : "text-primary-foreground"
            )}
            style={{ backgroundColor: hasColor ? value : undefined }}
          >
            <PipetteIcon className="size-4" />
          </span>
        </div>
        <Input
          id={id}
          placeholder="#rrggbb"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          spellCheck={false}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange("")}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  )
}
