import { defineConfig, normalizePath, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const demo = (file: string) => normalizePath(path.join(here, "src", "demo", "server", file));

/**
 * A static host has no API process. The client build swaps the four Node-only
 * pieces of the server for browser equivalents, so the real routes and engines
 * can run against a WASM SQLite database inside the tab.
 *
 * A live server is still preferred at runtime; see `src/demo/mode.ts`.
 */
function browserDemo(): Plugin {
  return {
    name: "equita-browser-demo",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "express") return demo("express.ts");
      if (source === "node:crypto") return demo("crypto.ts");
      if (importer && /[\\/]server[\\/]/.test(importer)) {
        if (source === "./db.js" || source === "../db.js") return demo("db.ts");
        if (source === "./bus.js") return demo("bus.ts");
      }
      return null;
    },
  };
}

/**
 * Wasmer's static host does not answer unknown paths with `index.html`, so a
 * refresh on `/today` was a hard 404. Static Web Server does serve `404.html`,
 * and that copy boots the same SPA on the requested path.
 *
 * The same pass preloads the browser demo's two heaviest files. On a static
 * host the landing page cannot show a single figure until `sql.js` and the
 * demo router have arrived, and both used to wait for the API probe to fail
 * first. Fetching them alongside the app bundle removes that second wait; a
 * live server ignores them.
 */
function spaFallback(): Plugin {
  return {
    name: "equita-spa-fallback",
    closeBundle() {
      const out = path.join(here, "dist");
      const index = path.join(out, "index.html");
      if (!existsSync(index)) return;

      const assetsDir = path.join(out, "assets");
      const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
      const server = assets.find((file) => /^server-.*\.js$/.test(file));
      const seed = assets.find((file) => /^seed-.*\.js$/.test(file));
      const wasm = assets.find((file) => /^sql-wasm-.*\.wasm$/.test(file));
      const tags = [
        server ? `<link rel="modulepreload" crossorigin fetchpriority="high" href="/assets/${server}">` : "",
        seed ? `<link rel="modulepreload" crossorigin fetchpriority="high" href="/assets/${seed}">` : "",
        wasm ? `<link rel="preload" as="fetch" crossorigin="anonymous" fetchpriority="high" type="application/wasm" href="/assets/${wasm}">` : "",
      ].filter(Boolean);

      let html = readFileSync(index, "utf8");
      if (tags.length && !(server && html.includes(`/assets/${server}`))) {
        html = html.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
        writeFileSync(index, html);
      }
      copyFileSync(index, path.join(out, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [browserDemo(), react(), tailwindcss(), spaFallback()],
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


