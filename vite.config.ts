import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 5174,
    watch: {
      // SQLite WAL przy logowaniu/typach — bez tego Vite robi pełny reload strony
      ignored: ["**/prisma/data/**", "**/*.db", "**/*.db-wal", "**/*.db-shm"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist/client",
  },
});
