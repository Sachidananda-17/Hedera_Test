import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {nodePolyfills} from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills()
  ],
  optimizeDeps: {
    include: ["buffer", "process"],
  },
  resolve: {
    alias: {
      buffer: "buffer",
      process: "process/browser",
    },
  },
});
