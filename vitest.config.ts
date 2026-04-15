import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      all: true,
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/dist/**",
        "**/coverage/**",
        "**/*.config.ts",
      ],
      thresholds: {
        100: true,
      },
    },
  },
});
