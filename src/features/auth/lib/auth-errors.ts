/**
 * Better Auth redirects to `/sign-in?error=<code>` when OAuth or a magic
 * link fails. Maps those codes (verified against better-auth 1.7.6) to
 * messages that say what happened and what to do (build plan §12.7).
 */
const messages: Record<string, string> = {
  // Magic link: expired, already used, or tampered with.
  INVALID_TOKEN:
    "That sign-in link has expired or was already used. Links last 5 minutes and work once — request a new one.",
  // OAuth: user pressed "Cancel" on Google or GitHub.
  access_denied: "Sign-in was cancelled. Choose a sign-in method to try again.",
  unable_to_link_account:
    "We couldn’t link this sign-in method to your existing account. Use the method you signed up with.",
  email_not_found:
    "We couldn’t get an email address from that account. Make your email visible on the provider, or use a magic link instead.",
  state_mismatch: "Your sign-in session expired. Start again from this page.",
}

const fallback = "Something went wrong while signing you in. Try again."

export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  return messages[code] ?? fallback
}
