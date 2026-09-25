import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { safeFetch, SafeFetchError, type NetworkPolicy } from "../safe-fetch"

const html = { accept: ["text/html"], maxBytes: 10_000 } as const

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e
  )
  expect(error).toBeInstanceOf(SafeFetchError)
  return (error as SafeFetchError).reason
}

describe("safeFetch with the public-web policy", () => {
  it.each([
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://[::ffff:127.0.0.1]/",
    "http://localhost/", // resolves to loopback: blocked at lookup
    "https://example.com:8443/", // non-standard port
    "ftp://example.com/",
    "file:///etc/passwd",
    "https://user:pass@example.com/",
  ])("refuses %s", async (url) => {
    expect(await failure(safeFetch(url, html))).toBe("blocked")
  })
})

describe("safeFetch against a local server", () => {
  let server: Server
  let base: string

  // Loopback on 127.0.0.1 only, any port: lets the test server through while
  // everything else (including other loopback addresses) stays blocked.
  const localPolicy: NetworkPolicy = {
    isAllowedAddress: (address) => address === "127.0.0.1",
    isAllowedPort: () => true,
  }
  const local = { ...html, policy: localPolicy }

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = req.url ?? "/"
      if (path === "/page") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        res.end("<h1>Hello</h1>")
      } else if (path === "/redirect") {
        res.writeHead(302, { location: "/page" })
        res.end()
      } else if (path === "/loop") {
        res.writeHead(302, { location: "/loop" })
        res.end()
      } else if (path === "/to-other-loopback") {
        const { port } = server.address() as AddressInfo
        res.writeHead(302, { location: `http://127.0.0.2:${port}/page` })
        res.end()
      } else if (path === "/json") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end("{}")
      } else if (path === "/big") {
        res.writeHead(200, { "content-type": "text/html" })
        res.end("x".repeat(20_000))
      } else if (path === "/slow") {
        res.writeHead(200, { "content-type": "text/html" })
        setTimeout(() => res.end("late"), 2_000)
      } else {
        res.writeHead(404, { "content-type": "text/html" })
        res.end("missing")
      }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  it("returns the body, content type and final URL", async () => {
    const result = await safeFetch(`${base}/page`, local)

    expect(result.contentType).toBe("text/html")
    expect(new TextDecoder().decode(result.body)).toBe("<h1>Hello</h1>")
    expect(result.url).toBe(`${base}/page`)
  })

  it("follows redirects and reports the final URL", async () => {
    const result = await safeFetch(`${base}/redirect`, local)

    expect(result.url).toBe(`${base}/page`)
  })

  it("re-checks the address on every redirect", async () => {
    expect(await failure(safeFetch(`${base}/to-other-loopback`, local))).toBe(
      "blocked"
    )
  })

  it("stops redirect loops", async () => {
    expect(await failure(safeFetch(`${base}/loop`, local))).toBe(
      "too_many_redirects"
    )
  })

  it("rejects content types that weren't asked for", async () => {
    expect(await failure(safeFetch(`${base}/json`, local))).toBe("wrong_type")
  })

  it("stops reading past the size cap", async () => {
    expect(await failure(safeFetch(`${base}/big`, local))).toBe("too_large")
  })

  it("reports error statuses", async () => {
    const error = await safeFetch(`${base}/nope`, local).catch((e) => e)

    expect(error).toMatchObject({ reason: "http_status", status: 404 })
  })

  it("gives up after the time limit", async () => {
    expect(
      await failure(safeFetch(`${base}/slow`, { ...local, timeoutMs: 300 }))
    ).toBe("timeout")
  })

  it("reports a host that can't be reached", async () => {
    server.close()
    expect(await failure(safeFetch(`${base}/page`, local))).toBe("unreachable")
  })
})
