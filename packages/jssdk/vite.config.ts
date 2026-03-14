import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: rootDir,
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(rootDir, "src/index.ts"),
      name: "ConfigCenterSDK",
      formats: ["es", "iife"],
      fileName: (format) => `cc-sdk-core.${format}.js`
    },
    rollupOptions: {
      output: {
        exports: "named"
      }
    }
  }
});
