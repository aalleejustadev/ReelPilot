"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { Button } from "@/shared/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import { Textarea } from "@/shared/ui/textarea"
import { toast } from "@/shared/ui/toast"

import { saveBrandKit } from "../actions"
import type { BrandKitDetail } from "../queries"
import { brandKitLimits as L, type BrandKitFieldsInput } from "../schema"
import { DeleteKitButton } from "./delete-kit-button"
import { LogoField } from "./logo-field"

type ClaimRow = { key: number; text: string; sourceUrl: string }
const colorSlots = ["primary", "secondary", "accent"] as const
const colorLabels = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
}

function formStateFrom(kit: BrandKitDetail) {
  return {
    name: kit.name,
    url: kit.url,
    description: kit.description,
    audience: kit.audience,
    features: kit.features.join("\n"),
    pricingSummary: kit.pricingSummary ?? "",
    bannedWords: kit.bannedWords.join("\n"),
    colors: {
      primary: kit.colors.primary ?? "",
      secondary: kit.colors.secondary ?? "",
      accent: kit.colors.accent ?? "",
    },
    fonts: { heading: kit.fonts.heading ?? "", body: kit.fonts.body ?? "" },
    tone: kit.tone ?? "",
  }
}

const lines = (text: string) => text.split("\n")
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim())

/**
 * The whole kit in one form. Inputs are controlled (build plan §12.5); the
 * logo uploads on its own. Viewers see the same form, disabled.
 */
export function BrandKitEditor({
  kit,
  logoUrl,
  readOnly,
}: {
  kit: BrandKitDetail
  logoUrl: string | null
  readOnly: boolean
}) {
  const [form, setForm] = useState(() => formStateFrom(kit))
  const [claims, setClaims] = useState<ClaimRow[]>(() =>
    kit.claims.map((claim, key) => ({
      key,
      text: claim.text,
      sourceUrl: claim.sourceUrl ?? "",
    }))
  )
  const [nextKey, setNextKey] = useState(kit.claims.length)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [isSaving, startSave] = useTransition()

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  /** First error for a field, including its list items ("features.3"). */
  const errorFor = (path: string) =>
    Object.entries(errors).find(
      ([key]) => key === path || key.startsWith(`${path}.`)
    )?.[1][0]
  const invalid = (path: string) => (errorFor(path) ? true : undefined)

  function save(event: React.FormEvent) {
    event.preventDefault()
    const fields: BrandKitFieldsInput = {
      ...form,
      features: lines(form.features),
      bannedWords: form.bannedWords.split(/[\n,]/),
      claims: claims.map(({ text, sourceUrl }) => ({ text, sourceUrl })),
      colors: {
        primary: form.colors.primary.trim() || undefined,
        secondary: form.colors.secondary.trim() || undefined,
        accent: form.colors.accent.trim() || undefined,
      },
    }
    startSave(async () => {
      const result = await saveBrandKit({ kitId: kit.id, fields })
      if (result.ok) {
        setErrors({})
        toast.add({ type: "success", title: "Brand kit saved" })
      } else {
        setErrors(result.error.fieldErrors ?? {})
        toast.add({ type: "error", title: result.error.message })
      }
    })
  }

  const saveButton = (
    <Button type="submit" form="brand-kit-form" disabled={isSaving}>
      {isSaving && <Spinner data-icon="inline-start" />}
      Save changes
    </Button>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {kit.name}
          </h1>
          <p className="text-muted-foreground">
            {readOnly
              ? "You can view this brand kit. Ask an owner for editor access to change it."
              : "What ReelPilot knows about your product. Every ad is written from this."}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <DeleteKitButton kitId={kit.id} kitName={kit.name} />
            {saveButton}
          </div>
        )}
      </div>

      <form id="brand-kit-form" onSubmit={save} noValidate>
        <FieldSet disabled={readOnly || isSaving} className="gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Product</CardTitle>
              <CardDescription>
                The basics every script starts from.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={invalid("name")}>
                  <FieldLabel htmlFor="kit-name">Name</FieldLabel>
                  <Input
                    id="kit-name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    maxLength={L.name}
                    aria-invalid={invalid("name")}
                  />
                  <FieldError>{errorFor("name")}</FieldError>
                </Field>
                <Field data-invalid={invalid("url")}>
                  <FieldLabel htmlFor="kit-url">Website</FieldLabel>
                  <Input
                    id="kit-url"
                    inputMode="url"
                    value={form.url}
                    onChange={(e) => set("url", e.target.value)}
                    aria-invalid={invalid("url")}
                  />
                  <FieldError>{errorFor("url")}</FieldError>
                </Field>
                <Field data-invalid={invalid("description")}>
                  <FieldLabel htmlFor="kit-description">
                    One-line description
                  </FieldLabel>
                  <Input
                    id="kit-description"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    maxLength={L.description}
                    aria-invalid={invalid("description")}
                  />
                  <FieldError>{errorFor("description")}</FieldError>
                </Field>
                <Field data-invalid={invalid("audience")}>
                  <FieldLabel htmlFor="kit-audience">Audience</FieldLabel>
                  <Textarea
                    id="kit-audience"
                    value={form.audience}
                    onChange={(e) => set("audience", e.target.value)}
                    maxLength={L.audience}
                    aria-invalid={invalid("audience")}
                  />
                  <FieldDescription>
                    Who it’s for, in your words.
                  </FieldDescription>
                  <FieldError>{errorFor("audience")}</FieldError>
                </Field>
                <Field data-invalid={invalid("features")}>
                  <FieldLabel htmlFor="kit-features">Key features</FieldLabel>
                  <Textarea
                    id="kit-features"
                    value={form.features}
                    onChange={(e) => set("features", e.target.value)}
                    aria-invalid={invalid("features")}
                  />
                  <FieldDescription>
                    One per line, up to {L.features}.
                  </FieldDescription>
                  <FieldError>{errorFor("features")}</FieldError>
                </Field>
                <Field data-invalid={invalid("pricingSummary")}>
                  <FieldLabel htmlFor="kit-pricing">Pricing</FieldLabel>
                  <Textarea
                    id="kit-pricing"
                    value={form.pricingSummary}
                    onChange={(e) => set("pricingSummary", e.target.value)}
                    maxLength={L.pricingSummary}
                    aria-invalid={invalid("pricingSummary")}
                  />
                  <FieldError>{errorFor("pricingSummary")}</FieldError>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allowed claims</CardTitle>
              <CardDescription>
                Numbers and promises your ads may use. Scripts can only make
                claims listed here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {claims.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No claims yet. Add one, like “Set up in 5 minutes”, with a
                    link that backs it up.
                  </p>
                )}
                {claims.map((claim, index) => (
                  <div
                    key={claim.key}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start"
                  >
                    <Field data-invalid={invalid(`claims.${index}.text`)}>
                      <FieldLabel htmlFor={`claim-${claim.key}-text`}>
                        Claim {index + 1}
                      </FieldLabel>
                      <Input
                        id={`claim-${claim.key}-text`}
                        value={claim.text}
                        maxLength={L.claim}
                        onChange={(e) =>
                          setClaims((rows) =>
                            rows.map((row) =>
                              row.key === claim.key
                                ? { ...row, text: e.target.value }
                                : row
                            )
                          )
                        }
                        aria-invalid={invalid(`claims.${index}.text`)}
                      />
                      <FieldError>
                        {errorFor(`claims.${index}.text`)}
                      </FieldError>
                    </Field>
                    <Field data-invalid={invalid(`claims.${index}.sourceUrl`)}>
                      <FieldLabel htmlFor={`claim-${claim.key}-source`}>
                        Source link
                      </FieldLabel>
                      <Input
                        id={`claim-${claim.key}-source`}
                        inputMode="url"
                        placeholder="https://"
                        value={claim.sourceUrl}
                        onChange={(e) =>
                          setClaims((rows) =>
                            rows.map((row) =>
                              row.key === claim.key
                                ? { ...row, sourceUrl: e.target.value }
                                : row
                            )
                          )
                        }
                        aria-invalid={invalid(`claims.${index}.sourceUrl`)}
                      />
                      <FieldError>
                        {errorFor(`claims.${index}.sourceUrl`)}
                      </FieldError>
                    </Field>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="self-start sm:mt-8"
                        aria-label={`Remove claim ${index + 1}`}
                        onClick={() =>
                          setClaims((rows) =>
                            rows.filter((row) => row.key !== claim.key)
                          )
                        }
                      >
                        <XIcon data-icon="inline-start" />
                        {/* Icon only beside the inputs on wider screens. */}
                        <span className="sm:hidden">Remove</span>
                      </Button>
                    )}
                  </div>
                ))}
              </FieldGroup>
            </CardContent>
            {!readOnly && (
              <CardFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={claims.length >= L.claims}
                  onClick={() => {
                    setClaims((rows) => [
                      ...rows,
                      { key: nextKey, text: "", sourceUrl: "" },
                    ])
                    setNextKey((key) => key + 1)
                  }}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add claim
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice</CardTitle>
              <CardDescription>How your ads should sound.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={invalid("tone")}>
                  <FieldLabel htmlFor="kit-tone">Tone</FieldLabel>
                  <Input
                    id="kit-tone"
                    placeholder="Friendly, plain, confident"
                    value={form.tone}
                    onChange={(e) => set("tone", e.target.value)}
                    maxLength={L.tone}
                    aria-invalid={invalid("tone")}
                  />
                  <FieldError>{errorFor("tone")}</FieldError>
                </Field>
                <Field data-invalid={invalid("bannedWords")}>
                  <FieldLabel htmlFor="kit-banned">Words to avoid</FieldLabel>
                  <Textarea
                    id="kit-banned"
                    value={form.bannedWords}
                    onChange={(e) => set("bannedWords", e.target.value)}
                    aria-invalid={invalid("bannedWords")}
                  />
                  <FieldDescription>
                    One per line or comma-separated. Scripts never use them.
                  </FieldDescription>
                  <FieldError>{errorFor("bannedWords")}</FieldError>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Look</CardTitle>
              <CardDescription>
                Used for captions, overlays and the logo sting in your ads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <LogoField
                  kitId={kit.id}
                  kitName={kit.name}
                  logoUrl={logoUrl}
                  readOnly={readOnly}
                />
                <div className="grid gap-6 sm:grid-cols-3">
                  {colorSlots.map((slot) => {
                    const value = form.colors[slot]
                    const path = `colors.${slot}`
                    return (
                      <Field key={slot} data-invalid={invalid(path)}>
                        <FieldLabel htmlFor={`kit-color-${slot}`}>
                          {colorLabels[slot]} colour
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-9 shrink-0 rounded-md border"
                            style={{
                              backgroundColor: isHex(value) ? value : undefined,
                            }}
                          />
                          <Input
                            id={`kit-color-${slot}`}
                            placeholder="#rrggbb"
                            value={value}
                            onChange={(e) =>
                              set("colors", {
                                ...form.colors,
                                [slot]: e.target.value,
                              })
                            }
                            aria-invalid={invalid(path)}
                          />
                        </div>
                        <FieldError>{errorFor(path)}</FieldError>
                      </Field>
                    )
                  })}
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  {(["heading", "body"] as const).map((slot) => (
                    <Field key={slot} data-invalid={invalid(`fonts.${slot}`)}>
                      <FieldLabel htmlFor={`kit-font-${slot}`}>
                        {slot === "heading" ? "Heading font" : "Body font"}
                      </FieldLabel>
                      <Input
                        id={`kit-font-${slot}`}
                        placeholder="Inter"
                        value={form.fonts[slot]}
                        onChange={(e) =>
                          set("fonts", {
                            ...form.fonts,
                            [slot]: e.target.value,
                          })
                        }
                        maxLength={L.font}
                        aria-invalid={invalid(`fonts.${slot}`)}
                      />
                      <FieldError>{errorFor(`fonts.${slot}`)}</FieldError>
                    </Field>
                  ))}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {!readOnly && <div className="flex justify-end">{saveButton}</div>}
        </FieldSet>
      </form>
    </div>
  )
}
