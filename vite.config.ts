import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      /*
       * The database lives in the project directory and its write-ahead log is
       * touched on every request. The watcher cannot tell that apart from a
       * source edit, so it was asking every open page to reload roughly every
       * two seconds — which looked, from the outside, like a site that would not
       * stay still. Only real source belongs on this list.
       */
      ignored: ["**/.git/**", "**/node_modules/**", "**/data/**", "**/.shots/**", "**/.playwright-mcp/**", "**/*.log"],
    },
    proxy: {
      // The API and the live event stream. `configure` keeps the SSE channel
      // unbuffered, otherwise http-proxy waits for a body that never ends.
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/events": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
        configure(proxy) {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-cache, no-transform";
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Vendor code is split by module path rather than by package name, which
        // rollup accepts without a schema fight.
        manualChunks(id) {
          if (id.includes("node_modules/@dnd-kit")) return "dnd";
          if (/node_modules[\/](react|react-dom|react-router|scheduler)[\/]/.test(id)) return "react";
          return undefined;
        },
      },
    },
  },
});