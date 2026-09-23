import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Vertical-slice boundaries (docs/build-plan.md §5.3).
const noAppImports = {
  group: ["@/app", "@/app/*"],
  message: "Nothing may import from src/app — routes are leaves.",
};
const noFeatureInternals = {
  group: ["@/features/*/*"],
  message:
    "Import other features only through their public API: '@/features/<name>' (index.ts).",
};
const noFeatures = {
  group: ["@/features", "@/features/*"],
  message: "src/shared must not depend on features.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**", "src/features/**", "src/remotion/**", "src/worker/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [noAppImports, noFeatureInternals] },
      ],
    },
  },
  {
    files: ["src/shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [noAppImports, noFeatures] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma generated client
    "src/shared/db/generated/**",
  ]),
]);

export default eslintConfig;
