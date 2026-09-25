import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components"

import { site } from "@/shared/config/site"

// Email clients ignore stylesheets, so styles are inline.
const styles = {
  body: {
    backgroundColor: "#EEF0F3",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    margin: "0 auto",
    maxWidth: "480px",
    padding: "32px",
  },
  heading: { color: "#15171C", fontSize: "20px", margin: "0 0 16px" },
  text: { color: "#15171C", fontSize: "14px", lineHeight: "22px" },
  button: {
    backgroundColor: "#15171C",
    borderRadius: "8px",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 500,
    padding: "10px 16px",
  },
  muted: { color: "#5B6170", fontSize: "12px", lineHeight: "18px" },
} as const

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your {site.name} sign-in link</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Sign in to {site.name}</Heading>
          <Text style={styles.text}>
            Click the button below to sign in. The link expires in 5 minutes and
            works once.
          </Text>
          <Button href={url} style={styles.button}>
            Sign in to {site.name}
          </Button>
          <Hr style={{ borderColor: "#D5D9E0", margin: "24px 0" }} />
          <Text style={styles.muted}>
            If you didn’t ask for this, you can ignore this email. Nobody can
            sign in without the link.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
