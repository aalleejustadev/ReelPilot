import { render } from "@react-email/components"
import { describe, expect, it } from "vitest"

import { MagicLinkEmail } from "../emails/magic-link-email"

const url = "https://reelpilot.test/api/auth/magic-link/verify?token=abc"

describe("MagicLinkEmail", () => {
  it("renders the sign-in link in HTML", async () => {
    const html = await render(<MagicLinkEmail url={url} />)
    expect(html).toContain(`href="${url.replace("&", "&amp;")}"`)
    expect(html).toContain("expires in 5 minutes")
  })

  it("has a plain-text version that includes the link", async () => {
    const text = await render(<MagicLinkEmail url={url} />, { plainText: true })
    expect(text).toContain(url)
    expect(text).not.toContain("<")
  })
})
