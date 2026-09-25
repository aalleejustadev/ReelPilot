import type { Metadata } from "next"

import { authErrorMessage, SignInCard } from "@/features/auth"

export const metadata: Metadata = { title: "Create your account" }

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return <SignInCard mode="sign-up" errorMessage={authErrorMessage(error)} />
}
