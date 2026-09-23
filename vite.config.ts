/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Relative base + hash routing: the static build works on Vercel, GitHub Pages or any host without configuration.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    include: ["pipeline/**/*.test.ts"],
  },
});
