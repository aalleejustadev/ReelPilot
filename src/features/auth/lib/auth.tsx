import "server-only"

import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins/magic-link"

import { env } from "@/shared/config/env"
import { site } from "@/shared/config/site"
import { db } from "@/shared/db"
import { sendEmail } from "@/shared/email"

import { MagicLinkEmail } from "../emails/magic-link-email"

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment
// (validated in env.ts); the skill says not to repeat them here.
export const auth = betterAuth({
  appName: site.name,
  database: prismaAdapter(db, { provider: "postgresql" }),

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },

  user: {
    additionalFields: {
      // Admin access (M11). input: false — sign-up can never set it.
      role: { type: "string", input: false, defaultValue: "USER" },
    },
  },

  account: {
    // One person, one account: Google, GitHub and magic link all resolve to
    // the same user when the email matches. Both providers return verified
    // emails, and a magic link proves ownership of the address.
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    // Google/GitHub access and refresh tokens are stored AES-256-GCM
    // encrypted (security skill). We don't call their APIs yet, but a
    // database leak must not hand out working provider tokens.
    encryptOAuthTokens: true,
  },

  session: {
    // Saves a database read per request; sessions are re-checked every 5 min.
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  rateLimit: {
    // "memory" resets on every serverless cold start
    // (better-auth-security-best-practices).
    storage: "database",
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 5,
      // A leaked database row can't be used to sign in.
      storeToken: "hashed",
      rateLimit: { window: 60, max: 3 },
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: `Your ${site.name} sign-in link`,
          react: <MagicLinkEmail url={url} />,
        })
      },
    }),
    // Must be last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
