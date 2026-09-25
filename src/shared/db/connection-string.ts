/**
 * Spells out the TLS mode node-postgres already uses. Neon's URLs say
 * `sslmode=require`, which pg treats as `verify-full` today but warns will
 * weaken to libpq's meaning (no certificate check) in its next major.
 * Asking for `verify-full` keeps the certificate check and ends the warning.
 * URLs without an sslmode (local Postgres) are left alone.
 */
export function withStrictSsl(connectionString: string) {
  const url = new URL(connectionString)
  const mode = url.searchParams.get("sslmode")
  if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full")
  }
  return url.toString()
}
