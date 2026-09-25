/**
 * Lets browsers on the app's origin upload straight to the media bucket
 * (signed POST) and read files. Idempotent; run once per Neon branch (and
 * again when the app's URL changes):
 *
 *   npm run storage:cors                      # NEXT_PUBLIC_APP_URL + e2e server
 *   npm run storage:cors -- https://app.example.com
 */
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const bucket = "media" // src/shared/storage/keys.ts MEDIA_BUCKET

const origins = [
  ...new Set(
    [
      ...process.argv.slice(2),
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3100", // Playwright's test server
    ]
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => new URL(origin).origin)
  ),
]

const s3 = new S3Client({
  forcePathStyle: true, // required by Neon (and MinIO)
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  region: process.env.AWS_REGION,
})

await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ["POST", "GET", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  })
)
const { CORSRules } = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }))
console.info(`CORS on "${bucket}":`, JSON.stringify(CORSRules?.[0]?.AllowedOrigins))
