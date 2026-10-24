import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/convex": fileURLToPath(new URL("../../convex", import.meta.url)),
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  server: { host: "0.0.0.0", port: 5174 },
  build: { outDir: "dist", emptyOutDir: true },
});
