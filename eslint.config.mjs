import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Vertical-slice boundaries (docs/build-plan.md §5.3).
const noAppImports = {
  group: ["@/app", "@/app/*"],
  message: "Nothing may import from src/app — routes are leaves.",
};
const noFeatureInternals = {
  // client.ts: the browser-safe part of a slice's API, for other slices'
  // client components (index.ts also exports server-only queries).
  group: ["@/features/*/*", "!@/features/*/client"],
  message:
    "Import other features only through their public API: '@/features/<name>' (index.ts), or '@/features/<name>/client' from client components.",
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
    // The worker may also import a feature's `jobs` entry (its job handlers),
    // because the feature's index.ts carries UI code the worker must not load.
    files: ["src/worker/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noAppImports,
            {
              group: ["@/features/*/*", "!@/features/*/jobs"],
              message:
                "The worker imports features only via '@/features/<name>/jobs'.",
            },
          ],
        },
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
  {
    // `_`-prefixed names are intentionally unused (e.g. a Playwright
    // fixture requested only for its side effect).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Playwright fixtures pass values via a callback named `use`, which the
    // React hooks rule mistakes for React's use() hook.
    files: ["tests/e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
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
