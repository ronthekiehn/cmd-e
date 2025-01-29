import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { chromeExtension } from "vite-plugin-chrome-extension";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
      alias: {
          "@": resolve(__dirname, "src"),
      },
  },
  build: {
      rollupOptions: {
          input: {
            manifest: resolve(__dirname, "src/manifest.json")
          }
      }
  },
  plugins: [
    react(),
    chromeExtension()
  ],
})
