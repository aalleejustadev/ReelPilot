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

/** Class that renders text in the named font (for previews only). */
export const fontPreviewClass: Record<AdFontName, string> = {
  Inter: inter.className,
  Montserrat: montserrat.className,
  Poppins: poppins.className,
  Roboto: roboto.className,
  "Open Sans": openSans.className,
  Lato: lato.className,
  "DM Sans": dmSans.className,
  Nunito: nunito.className,
  Raleway: raleway.className,
  Rubik: rubik.className,
  Oswald: oswald.className,
  "Bebas Neue": bebasNeue.className,
  Anton: anton.className,
  "Archivo Black": archivoBlack.className,
  "Playfair Display": playfairDisplay.className,
}
