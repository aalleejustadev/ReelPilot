"use client"

import { adFonts, toAdFont } from "@/shared/config/ad-fonts"
import { adFontClass } from "@/shared/lib/ad-font-faces"
import { cn } from "@/shared/lib/utils"
import { Field, FieldError, FieldLabel } from "@/shared/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"

const categories = [...new Set(adFonts.map((font) => font.category))]

// Each option's label is set in its own font, in the menu and the trigger.
const items = adFonts.map((font) => ({
  value: font.name,
  label: <span className={adFontClass[font.name]}>{font.name}</span>,
}))

/** Pick one of the ad fonts, with a live preview of `sample` below. */
export function FontField({
  id,
  label,
  role,
  value,
  sample,
  error,
  onChange,
}: {
  id: string
  label: string
  role: "heading" | "body"
  value: string
  sample: string
  error?: string
  onChange: (value: string) => void
}) {
  const font = adFonts.find((item) => item.name === toAdFont(value))

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={font?.name ?? null}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={error ? true : undefined}
        >
          <SelectValue placeholder="Choose a font" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectGroup key={category}>
              <SelectLabel>{category}</SelectLabel>
              {adFonts
                .filter((item) => item.category === category)
                .map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    <span className={adFontClass[item.name]}>{item.name}</span>
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <div className="flex min-h-20 items-center rounded-lg border bg-background px-4 py-3">
        {font ? (
          <p
            className={cn(
              adFontClass[font.name],
              "break-words",
              role === "heading" ? "text-2xl leading-tight" : "text-base"
            )}
            style={{
              fontWeight: role === "heading" ? font.headingWeight : 400,
            }}
          >
            {sample}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a font to see a preview.
          </p>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  )
}
