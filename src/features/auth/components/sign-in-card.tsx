"use client"

import { CircleAlertIcon, MailCheckIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { site } from "@/shared/config/site"
import { cn } from "@/shared/lib/utils"
import { Alert, AlertDescription } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"

import { authClient } from "../lib/auth-client"
import { GitHubIcon, GoogleIcon } from "./provider-icons"

const afterSignIn = "/dashboard"
const onError = "/sign-in"

// Layout only: roomier padding than the default card, and 40px controls.
const cardLayout =
  "[--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]"
const controlHeight = "h-10"

type Pending = "google" | "github" | "email" | null

const copy = {
  "sign-in": {
    title: "Welcome back",
    description: `Sign in to ${site.name} to keep making ads.`,
    switchText: "Don’t have an account?",
    switchLink: { href: "/sign-up", label: "Sign up" },
  },
  "sign-up": {
    title: "Create your account",
    description: "Start with Google, GitHub or your email. No password needed.",
    switchText: "Already have an account?",
    switchLink: { href: "/sign-in", label: "Sign in" },
  },
}

export function SignInCard({
  mode,
  errorMessage,
}: {
  mode: "sign-in" | "sign-up"
  errorMessage: string | null
}) {
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(errorMessage)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const text = copy[mode]

  async function signInWith(provider: "google" | "github") {
    setPending(provider)
    setError(null)
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: afterSignIn,
      errorCallbackURL: onError,
    })
    // On success the browser is already navigating to the provider.
    if (error) {
      setError("We couldn’t reach that provider. Try again in a moment.")
      setPending(null)
    }
  }

  // onSubmit, not <form action>: React runs form actions in a transition,
  // which holds back setPending until the request finishes, so the spinner
  // would never show.
  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(
      new FormData(event.currentTarget).get("email") ?? ""
    ).trim()
    setPending("email")
    setError(null)
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: afterSignIn,
      errorCallbackURL: onError,
    })
    setPending(null)
    if (error) {
      setError(
        error.status === 429
          ? "Too many sign-in links requested. Wait a minute, then try again."
          : "We couldn’t send the sign-in link. Check the address and try again."
      )
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <Card className={cardLayout}>
        <CardHeader className="flex flex-col items-center gap-2 text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <MailCheckIcon className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-base">
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{sentTo}</span>. It
            expires in 5 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="lg"
            className={cn("w-full", controlHeight)}
            onClick={() => setSentTo(null)}
          >
            Use a different email
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cardLayout}>
      <CardHeader className="gap-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {text.title}
        </CardTitle>
        <CardDescription className="text-base">
          {text.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-6">
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field className="gap-3">
            <Button
              variant="outline"
              size="lg"
              className={controlHeight}
              disabled={pending !== null}
              onClick={() => signInWith("google")}
            >
              {pending === "google" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GoogleIcon data-icon="inline-start" />
              )}
              Continue with Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={controlHeight}
              disabled={pending !== null}
              onClick={() => signInWith("github")}
            >
              {pending === "github" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GitHubIcon data-icon="inline-start" />
              )}
              Continue with GitHub
            </Button>
          </Field>
          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            Or continue with email
          </FieldSeparator>
          <form onSubmit={sendLink}>
            <FieldGroup className="gap-6">
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourapp.com"
                  className={controlHeight}
                  required
                />
              </Field>
              <Field className="gap-4">
                <Button
                  type="submit"
                  size="lg"
                  className={controlHeight}
                  disabled={pending !== null}
                >
                  {pending === "email" && <Spinner data-icon="inline-start" />}
                  Email me a sign-in link
                </Button>
                <FieldDescription className="text-center">
                  {text.switchText}{" "}
                  <Link href={text.switchLink.href}>
                    {text.switchLink.label}
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
