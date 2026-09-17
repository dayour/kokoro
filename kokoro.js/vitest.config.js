import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "kokoro-js": fileURLToPath(new URL("./src/kokoro.js", import.meta.url)),
    },
  },
});
