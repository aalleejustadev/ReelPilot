/**
 * Stands in for `next/font/google` in Vitest, where Next's font loader
 * doesn't run. Every font function returns an empty class and style.
 */
const font = () => ({
  className: "",
  style: { fontFamily: "sans-serif" },
  variable: "",
})

export default new Proxy({}, { get: () => font }) as Record<string, typeof font>

export const {
  Anton,
  Archivo_Black,
  Bebas_Neue,
  DM_Sans,
  Geist,
  Geist_Mono,
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
} = new Proxy({}, { get: () => font }) as Record<string, typeof font>
