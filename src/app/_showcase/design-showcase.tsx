import { FolderOpenIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { site } from "@/shared/config/site"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Separator } from "@/shared/ui/separator"
import { Skeleton } from "@/shared/ui/skeleton"

import {
  ContactSheetDemo,
  LoadingButtonDemo,
  SheetDemo,
  StatusBadge,
  ToastDemo,
  TooltipDemo,
  UserMenuDemo,
} from "./interactive-demos"

const swatches = [
  {
    token: "stage",
    hex: "#EEF0F3",
    role: "App background",
    className: "bg-stage",
  },
  {
    token: "surface",
    hex: "#FFFFFF",
    role: "Cards, dialogs",
    className: "bg-surface",
  },
  { token: "ink", hex: "#15171C", role: "Text, primary", className: "bg-ink" },
  { token: "slate", hex: "#5B6170", role: "Muted text", className: "bg-slate" },
  {
    token: "frame",
    hex: "#D5D9E0",
    role: "Borders, inputs",
    className: "bg-frame",
  },
  {
    token: "projector",
    hex: "#1B1D23",
    role: "Video player",
    className: "bg-projector",
  },
  {
    token: "chroma",
    hex: "#18B26B",
    role: "Ready, success",
    className: "bg-chroma",
  },
  {
    token: "chroma-strong",
    hex: "#007B38",
    role: "Focus ring",
    className: "bg-chroma-strong",
  },
  {
    token: "tally",
    hex: "#E5484D",
    role: "Recording, live",
    className: "bg-tally",
  },
  {
    token: "tally-strong",
    hex: "#CA2C37",
    role: "Destructive",
    className: "bg-tally-strong",
  },
  { token: "amber", hex: "#E8A23A", role: "Warnings", className: "bg-warning" },
]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

export function DesignShowcase() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <span className="text-base font-semibold tracking-tight">
          {site.name}
        </span>
        <UserMenuDemo />
      </header>

      <div className="flex flex-col gap-2">
        <Badge variant="outline">Design system</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {site.tagline}
        </h1>
        <p className="max-w-prose text-muted-foreground">
          A temporary showcase of ReelPilot’s theme on default shadcn
          components. The landing page replaces it in M12.
        </p>
      </div>

      <ContactSheetDemo />

      <Section
        title="Typography"
        description="Geist for everything; Geist Mono for timecodes and credit counts."
      >
        <div className="flex flex-col gap-3">
          <p className="text-4xl font-semibold tracking-tight">
            Ads that sell your app
          </p>
          <p className="text-2xl font-semibold tracking-tight">Section title</p>
          <p className="text-lg font-medium">Card title and emphasis</p>
          <p className="max-w-prose">
            Body text. Ads are built around your real screen recordings, with a
            presenter layered on top, and every script passes the compliance
            guard before it renders.
          </p>
          <p className="text-sm text-muted-foreground">
            Muted text for descriptions and metadata.
          </p>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="text-muted-foreground">
            Timecode <span className="font-mono text-foreground">00:12.40</span>
          </span>
          <span className="text-muted-foreground">
            Balance{" "}
            <span className="font-mono text-foreground">128.25 credits</span>
          </span>
        </div>
      </Section>

      <Section
        title="Colour"
        description="Neutral cool greys, with green for ready and red for live or destructive."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {swatches.map((swatch) => (
            <div key={swatch.token} className="flex items-center gap-3">
              <div
                className={`size-10 shrink-0 rounded-md ring-1 ring-foreground/10 ${swatch.className}`}
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {swatch.token}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{swatch.hex}</span> ·{" "}
                  {swatch.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Buttons"
        description="Default shadcn variants and sizes. Buttons say what happens."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <PlusIcon data-icon="inline-start" />
            New campaign
          </Button>
          <Button variant="outline">Preview</Button>
          <Button variant="secondary">Duplicate</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">
            <Trash2Icon data-icon="inline-start" />
            Delete ad
          </Button>
          <Button variant="link">View pricing</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <TooltipDemo />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LoadingButtonDemo />
          <SheetDemo />
        </div>
      </Section>

      <Section
        title="Status and feedback"
        description="Toasts use the same verb as the button: “Render” → “Rendering 12 ads”."
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="draft" />
          <StatusBadge status="rendering" />
          <StatusBadge status="ready" />
          <StatusBadge status="failed" />
          <Separator orientation="vertical" className="h-5" />
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <ToastDemo />
      </Section>

      <Section
        title="Forms"
        description="Fields group a label, control, description and error. Errors say what happened and what to do."
      >
        <FieldGroup className="max-w-xl">
          <Field>
            <FieldLabel htmlFor="app-url">Your app’s URL</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="app-url"
                type="url"
                placeholder="https://yourapp.com"
              />
              <Button>Make ads</Button>
            </div>
            <FieldDescription>
              We read your site to write your brief and first 10 hooks.
            </FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor="footage">Footage length</FieldLabel>
            <Input id="footage" defaultValue="14:32" aria-invalid />
            <FieldError>
              Your footage is longer than 10 minutes. Trim it or upload a
              shorter clip.
            </FieldError>
          </Field>
          <Field data-disabled>
            <FieldLabel htmlFor="brand">Brand kit name</FieldLabel>
            <Input id="brand" defaultValue="ReelPilot" disabled />
          </Field>
        </FieldGroup>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Empty state" description="Empty states invite action.">
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpenIcon />
              </EmptyMedia>
              <EmptyTitle>No campaigns yet</EmptyTitle>
              <EmptyDescription>
                Create your first one from your brand kit.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button>
                <PlusIcon data-icon="inline-start" />
                New campaign
              </Button>
            </EmptyContent>
          </Empty>
        </Section>
        <Section
          title="Loading"
          description="Skeletons hold the layout while data loads."
        >
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="aspect-9/16 w-10" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}
