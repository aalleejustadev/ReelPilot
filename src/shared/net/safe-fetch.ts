import "server-only"

import { lookup as dnsLookup, type LookupAddress } from "node:dns"
import { isIP, type LookupFunction } from "node:net"

import { Agent, fetch } from "undici"

import { site } from "@/shared/config/site"

import { isPublicAddress } from "./address-policy"

export type SafeFetchFailure =
  | "blocked" // not a public http(s) address
  | "unreachable" // DNS or connection failure
  | "timeout"
  | "http_status" // the site answered with an error status
  | "wrong_type" // not one of the accepted content types
  | "too_large"
  | "too_many_redirects"

export class SafeFetchError extends Error {
  readonly reason: SafeFetchFailure
  readonly status?: number

  constructor(
    reason: SafeFetchFailure,
    options?: { status?: number; cause?: unknown }
  ) {
    super(`Safe fetch failed: ${reason}`, { cause: options?.cause })
    this.name = "SafeFetchError"
    this.reason = reason
    this.status = options?.status
  }
}

/** Which addresses and ports may be contacted. Tests loosen it for a local server. */
export type NetworkPolicy = {
  isAllowedAddress: (address: string) => boolean
  isAllowedPort: (port: number) => boolean
}

export const publicWebPolicy: NetworkPolicy = {
  isAllowedAddress: isPublicAddress,
  isAllowedPort: (port) => port === 80 || port === 443,
}

export type SafeFetchOptions = {
  /** Accepted MIME types, e.g. ["text/html"]. */
  accept: readonly string[]
  maxBytes: number
  timeoutMs?: number
  maxRedirects?: number
  policy?: NetworkPolicy
}

export type SafeFetchResult = {
  /** Final URL after redirects. */
  url: string
  contentType: string
  body: Uint8Array
}

const userAgent = `${site.name}Bot/1.0 (+${site.url})`
const redirectStatuses = new Set([301, 302, 303, 307, 308])

/**
 * Checks every address a hostname resolves to, at connection time. Checking
 * here (not before the request) means a DNS answer can't change between the
 * check and the connection (DNS rebinding).
 */
function guardedLookup(policy: NetworkPolicy): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 0)
      const list = addresses as LookupAddress[]
      if (
        list.length === 0 ||
        list.some(({ address }) => !policy.isAllowedAddress(address))
      ) {
        return callback(new SafeFetchError("blocked"), "", 0)
      }
      if (options.all) return callback(null, list)
      const [first] = list as [LookupAddress]
      callback(null, first.address, first.family)
    })
  }
}

const agents = new WeakMap<NetworkPolicy, Agent>()
function agentFor(policy: NetworkPolicy) {
  let agent = agents.get(policy)
  if (!agent) {
    agent = new Agent({ connect: { lookup: guardedLookup(policy) } })
    agents.set(policy, agent)
  }
  return agent
}

function assertFetchable(url: URL, policy: NetworkPolicy) {
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80))
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const isWeb = url.protocol === "https:" || url.protocol === "http:"
  if (
    !isWeb ||
    url.username ||
    url.password ||
    !policy.isAllowedPort(port) ||
    // IP literals skip DNS lookup, so check them directly.
    (isIP(hostname) !== 0 && !policy.isAllowedAddress(hostname))
  ) {
    throw new SafeFetchError("blocked")
  }
}

function findCause(error: unknown): SafeFetchError | undefined {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e instanceof SafeFetchError) return e
  }
}

async function readLimited(
  body: AsyncIterable<Uint8Array> | null,
  maxBytes: number
) {
  const chunks: Uint8Array[] = []
  let size = 0
  if (body) {
    for await (const chunk of body) {
      size += chunk.byteLength
      if (size > maxBytes) throw new SafeFetchError("too_large")
      chunks.push(chunk)
    }
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * Fetches a user-supplied URL without letting it reach private networks:
 * public addresses and standard ports only (re-checked on every redirect),
 * a total time limit, a size cap and a content-type allowlist.
 * Throws SafeFetchError; callers turn its `reason` into a user message.
 */
export async function safeFetch(
  input: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  const policy = options.policy ?? publicWebPolicy
  const maxRedirects = options.maxRedirects ?? 5
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000)

  let url: URL
  try {
    url = new URL(input)
  } catch (error) {
    throw new SafeFetchError("blocked", { cause: error })
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    assertFetchable(url, policy)

    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetch(url, {
        dispatcher: agentFor(policy),
        redirect: "manual",
        signal,
        headers: {
          "user-agent": userAgent,
          accept: `${options.accept.join(", ")};q=1, */*;q=0.1`,
        },
      })
    } catch (error) {
      const known = findCause(error)
      if (known) throw known
      if (signal.aborted) throw new SafeFetchError("timeout", { cause: error })
      throw new SafeFetchError("unreachable", { cause: error })
    }

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get("location")
      await response.body?.cancel()
      if (!location) throw new SafeFetchError("http_status", { status: 502 })
      url = new URL(location, url)
      continue
    }

    try {
      if (!response.ok) {
        throw new SafeFetchError("http_status", { status: response.status })
      }
      const contentType =
        response.headers.get("content-type")?.split(";")[0]?.trim() ?? ""
      if (!options.accept.includes(contentType.toLowerCase())) {
        throw new SafeFetchError("wrong_type")
      }
      const declared = Number(response.headers.get("content-length"))
      if (declared > options.maxBytes) throw new SafeFetchError("too_large")

      const body = await readLimited(response.body, options.maxBytes)
      return { url: url.toString(), contentType, body }
    } catch (error) {
      await response.body?.cancel().catch(() => {})
      if (error instanceof SafeFetchError) throw error
      if (signal.aborted) throw new SafeFetchError("timeout", { cause: error })
      throw new SafeFetchError("unreachable", { cause: error })
    }
  }
  throw new SafeFetchError("too_many_redirects")
}
