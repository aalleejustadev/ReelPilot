import type { Metadata } from "next"

import { authErrorMessage, SignInCard } from "@/features/auth"

export const metadata: Metadata = { title: "Sign in" }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return <SignInCard mode="sign-in" errorMessage={authErrorMessage(error)} />
}
