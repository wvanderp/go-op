import { defineConfig } from "vite";
import path from "node:path";

const pkg = (name: string) =>
  path.resolve(__dirname, `../${name}/src/index.ts`);

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@go-op/types": pkg("types"),
      "@go-op/map": pkg("map"),
      "@go-op/protocol": pkg("protocol"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
