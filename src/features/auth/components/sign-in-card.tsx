"use client"

import { CircleAlertIcon, MailCheckIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { site } from "@/shared/config/site"
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

type Pending = "google" | "github" | "email" | null

const copy = {
  "sign-in": {
    title: `Sign in to ${site.name}`,
    description: "Use Google, GitHub or a sign-in link sent to your email.",
    switchText: "New here?",
    switchLink: { href: "/sign-up", label: "Create an account" },
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

  async function sendLink(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim()
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <MailCheckIcon className="mb-2 text-muted-foreground" aria-hidden />
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{sentTo}</span>. It
            expires in 5 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setSentTo(null)}
          >
            Use a different email
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field>
            <Button
              variant="outline"
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
            or
          </FieldSeparator>
          <form action={sendLink}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourapp.com"
                  required
                />
              </Field>
              <Field>
                <Button type="submit" disabled={pending !== null}>
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
