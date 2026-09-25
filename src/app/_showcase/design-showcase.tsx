import {
  ClapperboardIcon,
  CircleIcon,
  FolderOpenIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"

import { site } from "@/shared/config/site"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
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
    role: "Panels, dialogs",
    className: "bg-surface",
  },
  {
    token: "ink",
    hex: "#15171C",
    role: "Text, primary buttons",
    className: "bg-ink",
  },
  {
    token: "slate",
    hex: "#5B6170",
    role: "Secondary text, icons",
    className: "bg-slate",
  },
  {
    token: "frame",
    hex: "#D5D9E0",
    role: "Borders, timeline",
    className: "bg-frame",
  },
  {
    token: "projector",
    hex: "#1B1D23",
    role: "Player, preview stage",
    className: "bg-projector",
  },
  {
    token: "chroma",
    hex: "#18B26B",
    role: "Selection, ready (fills)",
    className: "bg-chroma",
  },
  {
    token: "chroma-strong",
    hex: "#007B38",
    role: "Green text, focus ring",
    className: "bg-chroma-strong",
  },
  {
    token: "chroma-soft",
    hex: "#DDF5E9",
    role: "Selected rows",
    className: "bg-chroma-soft",
  },
  {
    token: "tally",
    hex: "#E5484D",
    role: "Recording, live (fills)",
    className: "bg-tally",
  },
  {
    token: "tally-strong",
    hex: "#CA2C37",
    role: "Danger, errors (text)",
    className: "bg-tally-strong",
  },
  { token: "amber", hex: "#E8A23A", role: "Warnings", className: "bg-warning" },
]

const typeScale = [
  { className: "text-5xl", label: "5xl · 5rem" },
  { className: "text-4xl", label: "4xl · 3.75rem" },
  { className: "text-3xl", label: "3xl · 2.5rem" },
  { className: "text-2xl", label: "2xl · 1.75rem" },
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-3xl font-bold">{title}</h2>
        <p className="max-w-[72ch] text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-6">
      {children}
    </div>
  )
}

export function DesignShowcase() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ClapperboardIcon aria-hidden="true" />
          <span className="font-heading text-2xl font-extrabold">
            {site.name}
          </span>
          <Badge variant="outline">Design system</Badge>
        </div>
        <UserMenuDemo />
      </header>

      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          {site.tagline}
        </h1>
        <p className="max-w-[72ch] text-lg text-muted-foreground">
          A temporary showcase of the “cutting room” design system (build plan
          §12). The landing page replaces it in M12.
        </p>
      </div>

      <Section
        title="Typography"
        description="Big Shoulders for display text: hero, section titles, empty states. Schibsted Grotesk for everything else. Timecodes and credit counts use tabular numbers."
      >
        <Panel>
          {typeScale.map((type) => (
            <div
              key={type.className}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
            >
              <span className={`font-heading font-extrabold ${type.className}`}>
                Ads that sell it
              </span>
              <span className="text-xs text-muted-foreground">
                {type.label}
              </span>
            </div>
          ))}
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xl font-semibold">
              Paste your URL. Get ads in minutes. (xl · 600)
            </p>
            <p className="max-w-[72ch] text-base">
              Body text at 1rem. Ads are built around your real screen
              recordings, with a presenter layered on top, and every script
              passes the compliance guard before it renders.
            </p>
            <p className="text-sm text-muted-foreground">
              Secondary text at 0.875rem in slate.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              Timecode{" "}
              <span className="font-medium tabular-nums">00:12.40</span>
            </span>
            <span>
              Balance{" "}
              <span className="font-medium tabular-nums">128.25 credits</span>
            </span>
          </div>
        </Panel>
      </Section>

      <Section
        title="Colour"
        description="Quiet neutrals everywhere, so the contact sheet is the boldest thing on screen. Chroma and tally have darker “strong” shades for text; the plain shades fail WCAG AA as text."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {swatches.map((swatch) => (
            <div
              key={swatch.token}
              className="flex flex-col overflow-hidden rounded-lg border bg-card"
            >
              <div className={`h-16 border-b ${swatch.className}`} />
              <div className="flex flex-col gap-0.5 p-3">
                <span className="text-sm font-medium">{swatch.token}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {swatch.hex}
                </span>
                <span className="text-xs text-muted-foreground">
                  {swatch.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Radius"
        description="Radius follows hierarchy: 6px controls, 10px panels, 18px phone frames. No shadows on panels; borders do the work."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-28 rounded-sm border bg-card" />
            <span className="text-xs text-muted-foreground">6px · control</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-20 w-36 rounded-lg border bg-card" />
            <span className="text-xs text-muted-foreground">10px · panel</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex aspect-[9/16] w-24 items-center justify-center rounded-2xl border-4 border-ink bg-projector">
              <PlayIcon className="text-surface" aria-hidden="true" />
            </div>
            <span className="text-xs text-muted-foreground">18px · phone</span>
          </div>
        </div>
      </Section>

      <Section
        title="Buttons"
        description="Primary (ink), secondary (outline), ghost and danger (tally). Chroma is reserved for primary actions on dark surfaces. Buttons say what happens."
      >
        <Panel>
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
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-projector p-4">
            <Button variant="chroma">
              <WandSparklesIcon data-icon="inline-start" />
              Make ads
            </Button>
            <span className="text-sm text-surface">
              Chroma on the projector: primary action on dark surfaces.
            </span>
          </div>
        </Panel>
      </Section>

      <Section
        title="Contact sheet"
        description="Where the boldness goes: 9:16 frames on a projector strip. Click frames to select them; selection gets a chroma outline."
      >
        <ContactSheetDemo />
      </Section>

      <Section
        title="Status and feedback"
        description="Badges for render status, toasts for action results. The toast uses the same verb as the button (“Render” → “Rendering 12 ads”)."
      >
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="draft">Draft</Badge>
            <Badge variant="rendering">
              <CircleIcon data-icon="inline-start" className="fill-current" />
              Rendering
            </Badge>
            <Badge variant="ready">Ready</Badge>
            <Badge variant="failed">Failed</Badge>
            <Badge variant="warning">Warning</Badge>
            <Separator orientation="vertical" className="h-5" />
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <ToastDemo />
        </Panel>
      </Section>

      <Section
        title="Forms"
        description="Fields group a label, control, description and error. Errors say what happened and what to do."
      >
        <Panel>
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
        </Panel>
      </Section>

      <Section
        title="Empty and loading"
        description="Empty states invite action. Skeletons hold the layout while data loads."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Empty className="border bg-card">
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
          <Panel>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="aspect-[9/16] w-10" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </Section>
    </div>
  )
}
