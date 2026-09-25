import "server-only"

import { render } from "@react-email/components"
import { Resend } from "resend"

import { env } from "@/shared/config/env"
import { AppError } from "@/shared/lib/errors"

let client: Resend | undefined
const resend = () => (client ??= new Resend(env.RESEND_API_KEY))

/**
 * Sends a React Email template as HTML with a plain-text alternative.
 * Throws PROVIDER_FAILED if Resend rejects the message.
 */
export async function sendEmail(input: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ])

  const { error } = await resend().emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html,
    text,
  })

  if (error) {
    throw new AppError(
      "PROVIDER_FAILED",
      "We couldn't send that email. Try again in a moment.",
      { cause: error }
    )
  }
}
