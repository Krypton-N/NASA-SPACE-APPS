import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5173, open: true },
  preview: { port: 4173 },
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
});
