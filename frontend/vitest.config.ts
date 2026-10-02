import { defineConfig } from "vitest/config";
// Usa o mesmo plugin do vite.config.ts. Antes apontava para
// @vitejs/plugin-react-swc, que nunca esteve nas dependências — o que fazia
// `npm test` falhar na carga da config com ERR_MODULE_NOT_FOUND.
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
