/**
 * For tests that import modules which validate env on import (env.ts) but
 * never contact a real service. Fills only variables that are unset, so a
 * local .env still wins. Call it in beforeAll, before importing the module.
 */
export function fillPlaceholderEnv() {
  const placeholders = {
    DATABASE_URL: "postgresql://u:p@localhost/db",
    DATABASE_URL_UNPOOLED: "postgresql://u:p@localhost/db",
    BETTER_AUTH_SECRET: "a".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "x",
    GOOGLE_CLIENT_SECRET: "x",
    GITHUB_CLIENT_ID: "x",
    GITHUB_CLIENT_SECRET: "x",
    RESEND_API_KEY: "re_x",
    EMAIL_FROM: "x@example.com",
    AI_TEXT_PROVIDER: "anthropic",
    AI_TEXT_MODEL: "test-model",
    ANTHROPIC_API_KEY: "sk-ant-x",
    AWS_ACCESS_KEY_ID: "x",
    AWS_SECRET_ACCESS_KEY: "x",
    AWS_ENDPOINT_URL_S3: "https://storage.invalid",
    AWS_REGION: "us-east-2",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  }
  for (const [name, value] of Object.entries(placeholders)) {
    process.env[name] ??= value
  }
}
