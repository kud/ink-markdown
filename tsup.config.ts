import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  external: [
    "react",
    "ink",
    "markdown-it",
    "cli-highlight",
    "wrap-ansi",
    "slice-ansi",
    "string-width",
  ],
})
