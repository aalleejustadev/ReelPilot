/**
 * Seeds data every environment needs: the stock presenters (portraits and
 * voice samples). Safe to run again; only changes are applied.
 * Run: `npx prisma db seed` (also after `prisma migrate reset`).
 */
import { fileURLToPath } from "node:url"

import { syncStockPresenters } from "@/features/presenters/seed"
import { db } from "@/shared/db"
import { voiceProvider } from "@/shared/providers"

const portraitsDir = fileURLToPath(
  new URL("./seed-assets/presenters", import.meta.url)
)

async function main() {
  console.info("Seeding stock presenters…")
  const started = Date.now()
  const report = await syncStockPresenters({
    portraitsDir,
    voice: voiceProvider(),
    log: (line) => console.info(line),
  })
  console.info(
    `Presenters: ${report.presenters} (${report.portraitsUploaded} portraits uploaded, ${report.samplesMade} samples made, ${report.hidden} hidden) in ${Math.round((Date.now() - started) / 1000)}s`
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
