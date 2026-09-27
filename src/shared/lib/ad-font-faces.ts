import {
  Anton,
  Archivo_Black,
  Bebas_Neue,
  DM_Sans,
  Inter,
  Lato,
  Montserrat,
  Nunito,
  Open_Sans,
  Oswald,
  Playfair_Display,
  Poppins,
  Raleway,
  Roboto,
  Rubik,
} from "next/font/google"

import type { AdFontName } from "@/shared/config/ad-fonts"

// Self-hosted by next/font at build time: the browser never calls Google.
// preload: false — a file downloads only when its preview is shown.
// next/font needs each call spelled out with literal options.
const inter = Inter({ subsets: ["latin"], preload: false })
const montserrat = Montserrat({ subsets: ["latin"], preload: false })
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
})
const roboto = Roboto({ subsets: ["latin"], preload: false })
const openSans = Open_Sans({ subsets: ["latin"], preload: false })
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
})
const dmSans = DM_Sans({ subsets: ["latin"], preload: false })
const nunito = Nunito({ subsets: ["latin"], preload: false })
const raleway = Raleway({ subsets: ["latin"], preload: false })
const rubik = Rubik({ subsets: ["latin"], preload: false })
const oswald = Oswald({ subsets: ["latin"], preload: false })
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  preload: false,
})
const anton = Anton({ subsets: ["latin"], weight: "400", preload: false })
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  preload: false,
})
const playfairDisplay = Playfair_Display({ subsets: ["latin"], preload: false })

const faces = {
  Inter: inter,
  Montserrat: montserrat,
  Poppins: poppins,
  Roboto: roboto,
  "Open Sans": openSans,
  Lato: lato,
  "DM Sans": dmSans,
  Nunito: nunito,
  Raleway: raleway,
  Rubik: rubik,
  Oswald: oswald,
  "Bebas Neue": bebasNeue,
  Anton: anton,
  "Archivo Black": archivoBlack,
  "Playfair Display": playfairDisplay,
} satisfies Record<
  AdFontName,
  { className: string; style: { fontFamily: string } }
>

/** Class that renders text in the named font (menus, previews). */
export const adFontClass = Object.fromEntries(
  Object.entries(faces).map(([name, face]) => [name, face.className])
) as Record<AdFontName, string>

/**
 * CSS font-family for the named font (the stage's text). Self-hosted by
 * next/font; the file downloads the first time the font is shown.
 */
export const adFontFamily = Object.fromEntries(
  Object.entries(faces).map(([name, face]) => [name, face.style.fontFamily])
) as Record<AdFontName, string>
