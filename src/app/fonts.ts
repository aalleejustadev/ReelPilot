import { Geist, Geist_Mono } from "next/font/google"

// The app's fonts, declared once: the root layout and the global error
// page (which replaces it) share them. Declared in each, the build emitted
// a second, separate Geist stylesheet for the error page that every page
// then preloaded without using (a browser warning on every page).
export const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

// Timecodes and counts
export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})
