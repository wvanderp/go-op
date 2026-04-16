import path from "node:path";
import { defineConfig } from "vitest/config";

const pkg = (name: string) =>
  path.resolve(__dirname, `packages/${name}/src/index.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "@go-op/types": pkg("types"),
      "@go-op/map": pkg("map"),
      "@go-op/protocol": pkg("protocol"),
      "@go-op/server": pkg("server"),
      "@go-op/client": pkg("client"),
      "@go-op/ai-client": pkg("ai-client"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    server: {
      deps: {
        inline: [/ws/],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/dist/**",
        "**/coverage/**",
        "**/*.config.ts",
        "packages/client/src/main.ts",
        "packages/server/src/run.ts",
      ],
      thresholds: {
        100: true,
      },
    },
  },
});
