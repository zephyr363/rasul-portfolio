import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/rasul-portfolio/" : "/",
  // Свой порт: 5173 занят другим локальным проектом (terraklink).
  server: { port: 5180, strictPort: true },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Сборка в дефолтный dist/ — только локальная проверка, без деплоя.
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // Только React-тесты каркаса. Легаси-тесты (*.test.mjs на node:test)
    // запускаются через `npm run test:crm` / `node --test`, а не vitest.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
