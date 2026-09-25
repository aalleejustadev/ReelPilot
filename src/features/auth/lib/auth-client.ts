import { magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// Same origin as the app, so no baseURL is needed.
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})
